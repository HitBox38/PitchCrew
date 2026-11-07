import { randomUUID } from 'node:crypto';
import { access, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute } from 'node:path';
import type {
  ConversationSession,
  RuntimeId,
  RuntimeSetupInfo,
  RuntimeSetupOperation,
} from '@pitchcrew/core';
import { runtimeIds } from '@pitchcrew/core';
import {
  adapters,
  compareRuntimeVersions,
  findRuntimeExecutable,
  latestRuntimeVersion,
  maintenanceDefinitions,
  redactMaintenanceOutput,
  resolveRuntimeInstallation,
  runtimeUpdateCompatible,
  withRuntimeExecutables,
} from '@pitchcrew/adapters';
import type { CrewContext } from '../crew/types.ts';
import { runRuntimeInstaller } from '../runtime-maintenance/installer.ts';
import { drainConversationQueue } from '../crew/conversation-queue.ts';
import { RuntimeSetupStore } from './store.ts';
import {
  managedExecutable,
  ensureManagedPrefix,
  managedInstallCommand,
  managedPrefix,
  npmCli,
} from './managed-install.ts';

export const runtimeSetupHost = {
  detect: (id: RuntimeId) => adapters[id].detect(),
  resolve: resolveRuntimeInstallation,
  latest: latestRuntimeVersion,
  executable: findRuntimeExecutable,
  npm: npmCli,
  installed: managedExecutable,
  run: runRuntimeInstaller,
};

/** User-only executable configuration and optional managed installation. Never available to agents. */
export class RuntimeSetupManager {
  readonly store: RuntimeSetupStore;
  readonly host: typeof runtimeSetupHost;
  private readonly controllers = new Map<RuntimeId, AbortController>();
  constructor(
    readonly directory: string,
    readonly context: () => CrewContext,
    host: Partial<typeof runtimeSetupHost> = {},
  ) {
    this.store = new RuntimeSetupStore(directory);
    this.host = { ...runtimeSetupHost, ...host };
  }
  withExecutables = <T>(action: () => T): T => withRuntimeExecutables(this.store.paths(), action);
  diagnostics = async (id?: RuntimeId): Promise<RuntimeSetupInfo[]> =>
    Promise.all((id ? [id] : runtimeIds.filter((entry) => entry !== 'demo')).map(this.info));
  info = async (id: RuntimeId): Promise<RuntimeSetupInfo> => {
    this.realRuntime(id);
    const saved = this.store.state.paths[id];
    const executable = await this.withExecutables(() =>
      this.host.executable(maintenanceDefinitions[id].command),
    );
    const resolved = executable ? await realpath(executable).catch(() => null) : null;
    const runtime = this.context().runtimes.find((entry) => entry.id === id);
    const npm = maintenanceDefinitions[id].package ? await this.host.npm() : null;
    const maintenance = this.context().runtimeMaintenance;
    const busyReasons = maintenance.busy(id);
    if (maintenance.isUpdating(id))
      busyReasons.push('Runtime setup or maintenance is in progress.');
    let installation = maintenance.installations.get(id);
    if (!installation && executable && !busyReasons.length && !this.context().closing) {
      try {
        installation =
          (await maintenance.metadata(id, () =>
            this.host.resolve(id, maintenance.controller.signal),
          )) ?? undefined;
      } catch {
        /* A failed ownership probe stays unverified; it never authorizes an update. */
      }
    }
    const canInstall = !!(
      this.context().runtimeMaintenance.enabled &&
      npm &&
      maintenanceDefinitions[id].package &&
      !executable &&
      !saved &&
      !runtime?.version &&
      !busyReasons.length
    );
    return {
      id,
      configuredPath: saved?.path ?? null,
      executable,
      realPath: resolved,
      source: saved?.source ?? 'automatic',
      installer: installation?.installer ?? (saved?.source === 'managed' ? 'npm' : 'unverified'),
      canInstall,
      busyReasons,
      installDetail: executable
        ? 'An installation is already selected. Use its update action or change its executable.'
        : saved
          ? 'The configured executable is missing. Correct its path or return to automatic detection.'
          : !maintenanceDefinitions[id].package
            ? 'Install this runtime through its official native installer, then recheck.'
            : !npm
              ? 'Managed installation requires npm. Install Node.js with npm, then restart Pitchcrew or install the runtime manually.'
              : !this.context().runtimeMaintenance.enabled
                ? 'In-app runtime installation is disabled in this daemon.'
                : 'Installs the official npm distribution in this workspace’s data folder. Existing global installations are not changed.',
      ...(this.store.state.operations[id]
        ? { operation: structuredClone(this.store.state.operations[id]) }
        : {}),
    };
  };
  private realRuntime: (id: RuntimeId) => asserts id is Exclude<RuntimeId, 'demo'> = (id) => {
    if (id === 'demo' || !runtimeIds.includes(id))
      throw new Error('Choose a real supported runtime.');
  };
  private release = (id: RuntimeId) => {
    const context = this.context();
    context.runtimeMaintenance.active.delete(id);
    if (!context.closing) {
      void drainConversationQueue(context);
      void context.drainTasks();
    }
  };
  private assertIdle = (id: RuntimeId) => {
    this.realRuntime(id);
    const manager = this.context().runtimeMaintenance;
    if (this.context().closing || manager.controller.signal.aborted)
      throw new Error('The workspace is closing.');
    if (manager.isUpdating(id)) throw new Error('This runtime is already being set up or updated.');
    const reasons = manager.busy(id);
    if (reasons.length)
      throw new Error(`Wait for this runtime to become idle. ${reasons.join(' ')}`);
  };
  private invalidate = (id: RuntimeId) => {
    const context = this.context();
    context.modelCatalogs.delete(id);
    context.runtimeMaintenance.clearAuthentication(id);
    context.runtimeMaintenance.installations.delete(id);
    context.runtimeMaintenance.store.state.updates =
      context.runtimeMaintenance.store.state.updates.filter((entry) => entry.id !== id);
    delete context.runtimeMaintenance.store.state.identities[id];
    context.runtimeMaintenance.store.save();
    for (const session of context.board.list<ConversationSession>('conversation_session'))
      if (session.runtime === id && !session.invalid)
        context.board.record(
          'conversation_session',
          { ...session, invalid: true },
          'user',
          'Invalidated session after runtime executable changed',
        );
  };
  private adopt = (id: RuntimeId, entry?: { path: string; source: 'custom' | 'managed' }) => {
    const previous = this.store.state.paths[id];
    if (entry) this.store.state.paths[id] = entry;
    else delete this.store.state.paths[id];
    try {
      this.store.save();
    } catch (error) {
      if (previous) this.store.state.paths[id] = previous;
      else delete this.store.state.paths[id];
      throw error;
    }
  };
  configure = (id: RuntimeId, path: string | null): Promise<RuntimeSetupInfo> => {
    this.assertIdle(id);
    const manager = this.context().runtimeMaintenance;
    const operation = Promise.resolve()
      .then(async () => {
        if (path !== null) {
          if (
            typeof path !== 'string' ||
            !path.trim() ||
            path.length > 4096 ||
            !isAbsolute(path) ||
            /[\r\n\0]/.test(path)
          )
            throw new Error(
              'Enter an absolute executable path, without quotes or command arguments.',
            );
          const file = await stat(path).catch(() => {
            throw new Error('No file at this path. Check the executable location.');
          });
          if (!file.isFile()) throw new Error('Choose an executable file, not a folder.');
          try {
            await access(path, process.platform === 'win32' ? constants.R_OK : constants.X_OK);
          } catch {
            throw new Error(
              'No readable executable file at this path. Check the location and file permissions.',
            );
          }
        }
        const paths = this.store.paths();
        if (path === null) delete paths[id];
        else paths[id] = path;
        const health = await withRuntimeExecutables(paths, () => this.host.detect(id));
        if (path !== null && !health.version)
          throw new Error(
            'The selected file did not report a runtime version. Its previous configuration was kept.',
          );
        if (this.context().closing || manager.controller.signal.aborted)
          throw new Error('The workspace is closing.');
        this.invalidate(id);
        this.adopt(id, path === null ? undefined : { path, source: 'custom' });
        this.context().runtimes = this.context().runtimes.map((entry) =>
          entry.id === id ? { ...entry, ...health } : entry,
        );
      })
      .finally(() => this.release(id));
    manager.active.set(id, operation);
    return operation.then(() => this.info(id));
  };
  install = (id: RuntimeId): Promise<RuntimeSetupInfo> => {
    this.assertIdle(id);
    if (!this.context().runtimeMaintenance.enabled)
      throw new Error('In-app runtime installation is disabled in this daemon.');
    const controller = new AbortController();
    this.controllers.set(id, controller);
    this.store.state.operations[id] = {
      id: randomUUID(),
      stage: 'preparing',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      detail: 'Preparing an isolated runtime installation…',
      output: '',
    };
    try {
      this.store.save();
    } catch {
      this.controllers.delete(id);
      Object.assign(this.store.state.operations[id]!, {
        stage: 'failed',
        finishedAt: new Date().toISOString(),
        detail: 'Device storage is unavailable. Installation did not start.',
      });
      throw new Error('Device storage is unavailable. Installation did not start.');
    }
    const manager = this.context().runtimeMaintenance;
    const operation = Promise.resolve()
      .then(() => this.executeInstall(id, controller))
      .finally(() => {
        this.controllers.delete(id);
        this.release(id);
      });
    manager.active.set(id, operation);
    return this.info(id);
  };
  private executeInstall = async (id: RuntimeId, controller: AbortController) => {
    const operation = this.store.state.operations[id]!;
    let storageFailed = false;
    const persist = () => {
      try {
        this.store.save();
        return true;
      } catch {
        storageFailed = true;
        controller.abort();
        return false;
      }
    };
    const stage = (value: RuntimeSetupOperation['stage'], detail: string) => {
      operation.stage = value;
      operation.detail = detail;
      if (!persist()) throw new Error('Device storage is unavailable. Runtime setup stopped.');
    };
    try {
      this.realRuntime(id);
      const definition = maintenanceDefinitions[id];
      if (
        !definition.package ||
        this.store.state.paths[id] ||
        (await this.withExecutables(() => this.host.executable(definition.command)))
      )
        throw new Error(
          'Managed installation only creates a missing runtime. Existing selections are preserved.',
        );
      const npm = await this.host.npm();
      if (!npm)
        throw new Error(
          'npm is unavailable. Install Node.js with npm or use the official runtime installer.',
        );
      const latest = await this.host.latest(
        id,
        {
          executable: '',
          realPath: '',
          identity: '',
          installer: 'npm',
          manualCommand: '',
          detail: '',
        },
        controller.signal,
      );
      if (!latest || !runtimeUpdateCompatible(id, latest))
        throw new Error('A compatible stable runtime release could not be verified.');
      controller.signal.throwIfAborted();
      await ensureManagedPrefix(this.directory, id);
      stage(
        'installing',
        `Installing the verified ${latest} release into this workspace’s data folder…`,
      );
      const result = await this.host.run(managedInstallCommand(npm, this.directory, id, latest), {
        lockKey: `npm:${managedPrefix(this.directory, id)}`,
        signal: controller.signal,
        timeout: 600_000,
        onOutput: (text) => {
          operation.output = redactMaintenanceOutput(operation.output + text).slice(-16000);
          persist();
        },
      });
      if (result.code !== 0)
        throw new Error(
          'The runtime installer failed. Review its output and retry or install manually.',
        );
      controller.signal.throwIfAborted();
      stage('verifying', 'Verifying the installed executable and compatible version…');
      const executable = await this.host.installed(this.directory, id);
      const health = await withRuntimeExecutables({ ...this.store.paths(), [id]: executable }, () =>
        this.host.detect(id),
      );
      if (!health.available || (compareRuntimeVersions(health.version, latest) ?? -1) < 0)
        throw new Error(
          'The installer finished, but its expected compatible version could not be verified. The executable was not adopted.',
        );
      controller.signal.throwIfAborted();
      this.invalidate(id);
      this.adopt(id, { path: executable, source: 'managed' });
      this.context().runtimes = this.context().runtimes.map((entry) =>
        entry.id === id ? { ...entry, ...health } : entry,
      );
      stage(
        'succeeded',
        'Runtime installed and verified. Continue with sign-in and model selection.',
      );
    } catch (error) {
      operation.stage = storageFailed
        ? 'failed'
        : controller.signal.aborted
          ? 'cancelled'
          : 'failed';
      operation.detail = storageFailed
        ? 'Device storage is unavailable. Setup status could not be saved. Recheck the selected executable before retrying.'
        : error instanceof Error
          ? redactMaintenanceOutput(error.message).slice(0, 2000)
          : 'Runtime installation failed.';
    } finally {
      operation.finishedAt = new Date().toISOString();
      if (!persist()) {
        operation.stage = 'failed';
        operation.detail =
          'Device storage is unavailable. The final setup status could not be saved. Recheck the installation before retrying.';
      }
    }
  };
  cancel = async (id: RuntimeId, operationId?: string): Promise<RuntimeSetupInfo> => {
    this.realRuntime(id);
    const operation = this.store.state.operations[id];
    if (!operation || operation.finishedAt || (operationId && operation.id !== operationId))
      throw new Error('This setup operation is no longer active.');
    this.controllers.get(id)?.abort();
    await this.context().runtimeMaintenance.active.get(id);
    return this.info(id);
  };
  close = async () => {
    for (const controller of this.controllers.values()) controller.abort();
    await Promise.allSettled(
      [...this.controllers.keys()].map((id) => this.context().runtimeMaintenance.active.get(id)),
    );
  };
}
