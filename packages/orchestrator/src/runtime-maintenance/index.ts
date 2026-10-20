import { runRuntimeInstaller } from './installer.ts';
import { createHash, randomUUID } from 'node:crypto';
import type {
  Role,
  RuntimeAuthentication,
  RuntimeConfiguration,
  RuntimeId,
  RuntimeMaintenanceState,
  RuntimeUpdateInfo,
} from '@pitchcrew/core';
import {
  adapters,
  checkRuntimeAuthentication,
  resolveRuntimeInstallation,
  latestRuntimeVersion,
  compareRuntimeVersions,
  runtimeUpdateCompatible,
  redactMaintenanceOutput,
  type RuntimeInstallation,
} from '@pitchcrew/adapters';
import type { CrewContext } from '../crew/types.ts';
import { RuntimeMaintenanceStore } from './store.ts';
import { RuntimeHeldError, runtimeBusyReasons } from './availability.ts';
import { executeRuntimeUpdate } from './update.ts';

type Configuration = Pick<RuntimeConfiguration, 'runtime' | 'model'>;
export const runtimeMaintenanceHost = {
  authenticate: checkRuntimeAuthentication,
  resolve: resolveRuntimeInstallation,
  latest: latestRuntimeVersion,
  run: runRuntimeInstaller,
  now: () => Date.now(),
  detect: (context: CrewContext) => context.detect(),
};

/** User-owned daemon maintenance; no runtime gateway action can call this manager. */
export class RuntimeMaintenance {
  enabled = false;
  authenticationEnabled = false;
  readonly store: RuntimeMaintenanceStore;
  readonly host: typeof runtimeMaintenanceHost;
  readonly controller = new AbortController();
  readonly active = new Map<RuntimeId, Promise<void>>();
  readonly preparations = new Map<RuntimeId, number>();
  readonly installations = new Map<RuntimeId, RuntimeInstallation>();
  private readonly authentication = new Map<
    string,
    { config: Configuration; result: RuntimeAuthentication }
  >();
  private readonly authRequests = new Map<string, Promise<RuntimeAuthentication>>();
  private checkRequest?: Promise<RuntimeMaintenanceState>;
  private recovered = false;
  constructor(
    directory: string,
    readonly context: () => CrewContext,
    host: Partial<typeof runtimeMaintenanceHost> = {},
  ) {
    this.store = new RuntimeMaintenanceStore(directory);
    this.host = { ...runtimeMaintenanceHost, ...host };
  }
  get checking() {
    return !!this.checkRequest;
  }
  revision = () => {
    return {
      state: this.store.state,
      checking: this.checking,
      authentication: [...this.authentication.values()],
      active: [...this.active.keys()],
      preparations: [...this.preparations].filter(([, count]) => count > 0),
      installations: [...this.installations].map(([id, entry]) => [id, entry.identity]),
      enabled: this.enabled,
    };
  };
  isUpdating = (id: RuntimeId) => {
    return this.active.has(id) || !!this.store.state.running[id];
  };
  hasUpdatesRunning = () => {
    return this.active.size > 0 || Object.keys(this.store.state.running).length > 0;
  };
  current = (): RuntimeMaintenanceState => {
    return structuredClone({
      enabled: this.enabled,
      automatic: this.store.state.automatic,
      checking: this.checking,
      nextCheckAt: this.store.state.nextCheckAt,
      updates: this.store.state.updates.map((update) => ({
        ...update,
        busyReasons: this.busy(update.id),
        canUpdate:
          this.enabled &&
          update.canUpdate &&
          this.installations.has(update.id) &&
          !this.isUpdating(update.id),
      })),
      authentication: [...this.authentication.values()].map(({ config, result }) => ({
        ...config,
        result,
      })),
    });
  };
  configure = (automatic: boolean) => {
    this.store.state.automatic = automatic;
    this.store.save();
    return this.current();
  };
  busy = (id: RuntimeId) => {
    return [
      ...runtimeBusyReasons(this.context(), id),
      ...(this.preparations.get(id) ? ['Runtime startup or metadata checks are in progress.'] : []),
    ];
  };
  held = (config: Configuration) => {
    const cached = this.authentication.get(this.key(config))?.result;
    return (
      this.isUpdating(config.runtime) ||
      (cached?.status === 'missing' && this.host.now() - Date.parse(cached.checkedAt) < 5 * 60_000)
    );
  };
  private key = (config: Configuration) => {
    const environment = Object.entries(process.env)
      .filter(([key]) => /AUTH|TOKEN|KEY|PROVIDER|BASE_URL|HOME|PATH/i.test(key))
      .sort(([a], [b]) => a.localeCompare(b));
    return createHash('sha256')
      .update(JSON.stringify([config.runtime, config.model, environment]))
      .digest('hex');
  };
  authenticate = async (config: Configuration, force = false): Promise<RuntimeAuthentication> => {
    if (!this.authenticationEnabled && config.runtime !== 'demo')
      return {
        status: 'unknown',
        checkedAt: new Date().toISOString(),
        detail: 'Authentication probes are disabled in this daemon.',
        instructions: 'Recheck with authentication probes enabled.',
      };
    const key = this.key(config);
    const cached = this.authentication.get(key);
    if (!force && cached && this.host.now() - Date.parse(cached.result.checkedAt) < 5 * 60_000)
      return cached.result;
    const pending = this.authRequests.get(key);
    if (pending) return pending;
    this.preparations.set(config.runtime, (this.preparations.get(config.runtime) ?? 0) + 1);
    const request = this.host
      .authenticate(config, this.controller.signal)
      .then((result) => {
        if (this.authentication.size >= 100)
          this.authentication.delete(this.authentication.keys().next().value!);
        for (const [oldKey, old] of this.authentication)
          if (old.config.runtime === config.runtime && old.config.model === config.model)
            this.authentication.delete(oldKey);
        this.authentication.set(key, {
          config: { runtime: config.runtime, model: config.model },
          result,
        });
        return result;
      })
      .finally(() => {
        this.authRequests.delete(key);
        this.preparations.set(
          config.runtime,
          Math.max(0, (this.preparations.get(config.runtime) ?? 1) - 1),
        );
      });
    this.authRequests.set(key, request);
    return request;
  };
  guard = async <T>(
    config: Configuration,
    action: () => Promise<T>,
    force = false,
    current: () => Configuration = () => config,
  ): Promise<T> => {
    if (this.context().closing || this.controller.signal.aborted)
      throw new RuntimeHeldError('The workspace is closing.');
    if (this.isUpdating(config.runtime))
      throw new RuntimeHeldError(
        'This runtime is updating. Your work can resume when verification finishes.',
      );
    this.preparations.set(config.runtime, (this.preparations.get(config.runtime) ?? 0) + 1);
    try {
      const auth = await this.authenticate(config, force);
      if (auth.status === 'missing')
        throw new RuntimeHeldError(
          `${auth.detail} Open Settings > Runtimes for setup and Recheck.`,
        );
      if (this.context().closing) throw new RuntimeHeldError('The workspace is closing.');
      const latest = current();
      if (latest.runtime !== config.runtime || latest.model !== config.model)
        throw new RuntimeHeldError(
          'Runtime settings changed during preparation. Retry with the current settings.',
        );
      return await action();
    } finally {
      this.preparations.set(
        config.runtime,
        Math.max(0, (this.preparations.get(config.runtime) ?? 1) - 1),
      );
    }
  };
  metadata = async <T>(id: RuntimeId, action: () => Promise<T>): Promise<T> => {
    if (this.isUpdating(id))
      throw new RuntimeHeldError('This runtime is updating. Wait for verification.');
    this.preparations.set(id, (this.preparations.get(id) ?? 0) + 1);
    try {
      return await action();
    } finally {
      this.preparations.set(id, Math.max(0, (this.preparations.get(id) ?? 1) - 1));
    }
  };
  initializeAuthentication = async (force = false) => {
    const context = this.context();
    const configs: Configuration[] = context.runtimes
      .filter((runtime) => runtime.available)
      .map((runtime) => ({ runtime: runtime.id, model: '' }));
    configs.push(
      ...context.board
        .list<Role>('role')
        .filter(
          (role) =>
            !role.retiredAt &&
            context.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available),
        ),
    );
    for (const conversation of context.board.list<import('@pitchcrew/core').Conversation>(
      'conversation',
    )) {
      if (conversation.deletedAt) continue;
      for (const [roleId, overrides] of Object.entries(conversation.configurations)) {
        const role = context.board.list<Role>('role').find((entry) => entry.id === roleId);
        if (role && !role.retiredAt) configs.push({ ...role, ...overrides });
      }
    }
    await Promise.all(
      configs.map((config) =>
        this.isUpdating(config.runtime)
          ? undefined
          : this.guard(config, async () => {}, force).catch(() => {}),
      ),
    );
  };
  check = (automatic = false): Promise<RuntimeMaintenanceState> => {
    if (!this.enabled) return Promise.resolve(this.current());
    if (this.context().closing) return Promise.reject(new Error('The workspace is closing.'));
    if (this.checkRequest) return this.checkRequest;
    if (
      automatic &&
      (!this.store.state.automatic ||
        Date.parse(this.store.state.nextCheckAt ?? '') > this.host.now())
    )
      return Promise.resolve(this.current());
    this.store.state.nextCheckAt = new Date(this.host.now() + 24 * 60 * 60_000).toISOString();
    this.store.save();
    const request = Promise.resolve()
      .then(async () => {
        await this.host.detect(this.context());
        return Promise.all(
          this.context()
            .runtimes.filter(
              (runtime) =>
                runtime.id !== 'demo' &&
                (runtime.available || !!runtime.version) &&
                !this.isUpdating(runtime.id),
            )
            .map(async (runtime) => {
              const old = this.store.state.updates.find((update) => update.id === runtime.id);
              let update: RuntimeUpdateInfo = old ?? {
                id: runtime.id,
                status: 'unchecked',
                installedVersion: runtime.version,
                latestVersion: null,
                checkedAt: null,
                lastSuccessAt: null,
                detail: '',
                installer: 'manual',
                canUpdate: false,
                manualCommand: '',
              };
              const checkedAt = new Date(this.host.now()).toISOString();
              this.preparations.set(runtime.id, (this.preparations.get(runtime.id) ?? 0) + 1);
              try {
                const installation = await this.host.resolve(
                  runtime.id as Exclude<RuntimeId, 'demo'>,
                  this.controller.signal,
                );
                if (!installation)
                  throw new Error('The runtime executable is no longer installed.');
                this.installations.set(runtime.id, installation);
                this.store.state.identities[runtime.id] = installation.identity;
                const latest = await this.host.latest(
                  runtime.id as Exclude<RuntimeId, 'demo'>,
                  installation,
                  this.controller.signal,
                );
                const difference = latest ? compareRuntimeVersions(latest, runtime.version) : null;
                update = {
                  ...update,
                  installedVersion: runtime.version,
                  latestVersion: latest,
                  checkedAt,
                  lastSuccessAt: latest ? checkedAt : update.lastSuccessAt,
                  installer: installation.installer,
                  manualCommand: installation.manualCommand,
                  canUpdate:
                    !!installation.command &&
                    difference === 1 &&
                    !!latest &&
                    runtimeUpdateCompatible(runtime.id, latest),
                  status:
                    difference === null ? 'unknown' : difference > 0 ? 'available' : 'current',
                  detail:
                    difference === null
                      ? `${installation.detail} Stable release availability could not be verified.`
                      : latest && !runtimeUpdateCompatible(runtime.id, latest)
                        ? 'The latest stable release is incompatible with Pitchcrew. Keep the installed version or update Pitchcrew first.'
                        : installation.detail,
                };
              } catch {
                update = {
                  ...update,
                  installedVersion: runtime.version,
                  checkedAt,
                  canUpdate: false,
                  detail:
                    'Could not check runtime updates. The last known release is retained; try again when online.',
                  status: old?.status === 'available' ? 'available' : 'unknown',
                };
              } finally {
                this.preparations.set(
                  runtime.id,
                  Math.max(0, (this.preparations.get(runtime.id) ?? 1) - 1),
                );
              }
              this.store.state.updates = [
                ...this.store.state.updates.filter((entry) => entry.id !== runtime.id),
                update,
              ];
              this.store.save();
            }),
        );
      })
      .then(() => {
        this.checkRequest = undefined;
        return this.current();
      })
      .finally(() => {
        this.checkRequest = undefined;
      });
    this.checkRequest = request;
    return request;
  };
  startUpdate = (id: RuntimeId) => {
    if (!this.enabled)
      throw new Error('Runtime release checks and in-app updates are disabled in this daemon.');
    if (this.active.has(id)) return this.current();
    if (this.context().closing || this.isUpdating(id))
      throw new Error('A runtime update is already in progress or awaiting recovery.');
    const reasons = this.busy(id);
    if (reasons.length)
      throw new Error(`Wait for this runtime to become idle. ${reasons.join(' ')}`);
    const update = this.store.state.updates.find((entry) => entry.id === id);
    if (!update?.canUpdate || !update.latestVersion || !this.installations.has(id))
      throw new Error(
        'Check runtime updates first. This installation may require a manual update.',
      );
    update.operation = {
      id: randomUUID(),
      stage: 'preparing',
      startedAt: new Date(this.host.now()).toISOString(),
      finishedAt: null,
      output: '',
      detail: 'Preparing runtime update…',
    };
    this.store.save();
    // Reserve synchronously before the first await; another launch cannot pass the gate.
    const operation = Promise.resolve()
      .then(() => executeRuntimeUpdate(this, id))
      .finally(() => this.active.delete(id));
    this.active.set(id, operation);
    return this.current();
  };
  clearAuthentication = (id: RuntimeId) => {
    for (const [key, entry] of this.authentication)
      if (entry.config.runtime === id) this.authentication.delete(key);
  };
  refreshOnRetry = async (config: Configuration) => {
    if (
      !this.isUpdating(config.runtime) &&
      this.authentication.get(this.key(config))?.result.status === 'missing'
    )
      await this.authenticate(config, true);
  };
  output = (id: RuntimeId, chunk: string) => {
    const operation = this.store.state.updates.find((entry) => entry.id === id)?.operation;
    if (operation)
      operation.output = redactMaintenanceOutput(operation.output + chunk).slice(-16_000);
  };
  recover = async () => {
    if (this.recovered || this.active.size) return;
    let waiting = false;
    for (const update of this.store.state.updates) {
      if (!update.operation || update.operation.finishedAt) continue;
      const pid = this.store.state.running[update.id];
      if (pid) {
        try {
          process.kill(pid, 0);
          waiting = true;
          continue;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
            waiting = true;
            continue;
          }
        }
      }
      delete this.store.state.running[update.id];
      update.operation = {
        ...update.operation,
        stage: 'interrupted',
        finishedAt: new Date().toISOString(),
        detail: 'The daemon stopped during this update. Recheck the runtime before retrying.',
      };
      update.canUpdate = false;
      this.clearAuthentication(update.id);
      const health = await adapters[update.id].detect();
      this.context().runtimes = this.context().runtimes.map((runtime) =>
        runtime.id === update.id ? { ...runtime, ...health } : runtime,
      );
      this.store.save();
    }
    for (const update of this.store.state.updates) {
      if (
        this.isUpdating(update.id) ||
        !update.canUpdate ||
        this.installations.has(update.id) ||
        update.id === 'demo'
      )
        continue;
      try {
        const installation = await this.host.resolve(update.id, this.controller.signal);
        if (installation?.identity === this.store.state.identities[update.id])
          this.installations.set(update.id, installation);
        else {
          update.canUpdate = false;
          update.detail = 'The runtime installation changed. Check updates again.';
        }
      } catch {
        update.canUpdate = false;
        update.detail = 'Recheck this runtime to restore its update controls.';
      }
      this.store.save();
    }
    this.recovered = !waiting;
  };
  finishBeforeShutdown = async () => {
    this.context().closing = true;
    await Promise.allSettled([...this.active.values()]);
    while (Object.keys(this.store.state.running).length) {
      await this.recover();
      if (Object.keys(this.store.state.running).length)
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
  };
  close = async () => {
    this.controller.abort();
    await Promise.allSettled([
      ...this.active.values(),
      ...this.authRequests.values(),
      ...(this.checkRequest ? [this.checkRequest] : []),
    ]);
  };
}
