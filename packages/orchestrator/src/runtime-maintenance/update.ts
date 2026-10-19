import { adapters, compareRuntimeVersions, runtimeUpdateCompatible } from '@pitchcrew/adapters';
import type { RuntimeId } from '@pitchcrew/core';
import type { RuntimeMaintenance } from './index.ts';
import { drainConversationQueue } from '../crew/conversation-queue.ts';

export async function executeRuntimeUpdate(
  manager: RuntimeMaintenance,
  id: RuntimeId,
): Promise<void> {
  const update = manager.store.state.updates.find((entry) => entry.id === id)!;
  const operation = update.operation!;
  const stage = (value: typeof operation.stage, detail: string) => {
    operation.stage = value;
    operation.detail = detail;
    manager.store.save();
  };
  try {
    if (id === 'demo') throw new Error('Demo cannot be updated.');
    const previous = manager.installations.get(id)!;
    const installation = await manager.host.resolve(id, manager.controller.signal);
    if (!installation?.command || installation.identity !== previous.identity) {
      update.canUpdate = false;
      throw new Error('The runtime installation changed. Check updates again before retrying.');
    }
    const latest = await manager.host.latest(id, installation, manager.controller.signal);
    if (!latest || latest !== update.latestVersion) {
      update.canUpdate = false;
      throw new Error('The available runtime release changed. Check updates again.');
    }
    if (!runtimeUpdateCompatible(id, latest))
      throw new Error('The advertised release is incompatible with Pitchcrew.');
    const installed = await adapters[id].detect();
    const newer = compareRuntimeVersions(latest, installed.version);
    if (newer === null) throw new Error('Could not verify the installed version before updating.');
    if (newer <= 0) {
      manager.context().runtimes = manager
        .context()
        .runtimes.map((runtime) => (runtime.id === id ? { ...runtime, ...installed } : runtime));
      manager.context().modelCatalogs.delete(id);
      manager.clearAuthentication(id);
      update.installedVersion = installed.version;
      update.status = 'current';
      update.canUpdate = false;
      stage(
        'succeeded',
        'The installed version is already current or newer. No installer was run.',
      );
      return;
    }
    stage('updating', 'Updating through the existing installer…');
    const result = await manager.host.run(installation.command, {
      lockKey: installation.lockKey ?? installation.executable,
      signal: manager.controller.signal,
      timeout: 10 * 60_000,
      onSpawn: (pid) => {
        manager.store.state.running[id] = pid;
        manager.store.save();
      },
      onOutput: (text) => manager.output(id, text),
    });
    if (result.code !== 0)
      throw new Error(
        'The installer failed. See its output; use manual instructions if it needs permissions or interactive input.',
      );
    stage('verifying', 'Verifying the installed version…');
    const verified = await manager.host.resolve(id, manager.controller.signal);
    if (
      !verified ||
      verified.executable !== installation.executable ||
      verified.installer !== installation.installer ||
      verified.lockKey !== installation.lockKey
    )
      throw new Error(
        'The active runtime installation changed during the update. Recheck before continuing.',
      );
    const health = await adapters[id].detect();
    const comparison = compareRuntimeVersions(health.version, latest);
    if (!health.available || comparison === null || comparison < 0)
      throw new Error(
        'The installer finished, but the expected compatible version was not found on PATH.',
      );
    const context = manager.context();
    context.runtimes = context.runtimes.map((runtime) =>
      runtime.id === id ? { ...runtime, ...health } : runtime,
    );
    context.modelCatalogs.delete(id);
    manager.clearAuthentication(id);
    await manager.authenticate({ runtime: id, model: '' }, true);
    update.installedVersion = health.version;
    update.status = 'current';
    update.canUpdate = false;
    stage('succeeded', 'Runtime updated. Authentication readiness is shown separately.');
  } catch (error) {
    stage(
      manager.controller.signal.aborted ? 'interrupted' : 'failed',
      error instanceof Error ? error.message : 'Runtime update failed.',
    );
    const context = manager.context();
    const health = await adapters[id].detect();
    context.runtimes = context.runtimes.map((runtime) =>
      runtime.id === id ? { ...runtime, ...health } : runtime,
    );
    context.modelCatalogs.delete(id);
    update.installedVersion = health.version;
    if (!health.version) update.canUpdate = false;
    manager.clearAuthentication(id);
    if (!manager.controller.signal.aborted && health.available)
      await manager.authenticate({ runtime: id, model: '' }, true);
  } finally {
    operation.finishedAt = new Date().toISOString();
    delete manager.store.state.running[id];
    manager.store.save();
    // Release reservation before draining, including failed updates with a usable old version.
    manager.active.delete(id);
    if (!manager.context().closing) {
      void drainConversationQueue(manager.context());
      void manager.context().drainTasks();
    }
  }
}
