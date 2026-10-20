import type { DaemonPlan } from './launcher.ts';

export interface UpdateHandoffDependencies {
  plan: DaemonPlan;
  matchesService(): Promise<boolean>;
  externalService?(): Promise<boolean>;
  stopService(): Promise<void>;
  startService(): Promise<void>;
  stopOwned(): Promise<void>;
  startOwned(): Promise<void>;
  answers(): Promise<boolean>;
  sleep(ms: number): Promise<void>;
}

/** Leaves external daemons alone and keeps service restart policy under its service manager. */
export const createUpdateHandoff = (deps: UpdateHandoffDependencies) => {
  let stopped = false;
  const serviceOwned =
    deps.plan.action === 'start-service' ||
    (deps.plan.action === 'reuse' && deps.plan.owner === 'service');
  const available = async () =>
    (deps.plan.action === 'spawn' && !(await deps.externalService?.())) ||
    (serviceOwned && (await deps.matchesService()));
  return {
    available,
    prepare: async () => {
      if (!(await available()))
        throw new Error('Close the separately running daemon before updating.');
      // Remember partial stops as well, so failures can recover the previous runtime.
      stopped = true;
      if (serviceOwned) await deps.stopService();
      else await deps.stopOwned();
      for (let i = 0; i < 120; i++) {
        if (!(await deps.answers())) return;
        await deps.sleep(250);
      }
      throw new Error('The daemon did not stop. The update was not installed.');
    },
    recover: async () => {
      if (!stopped) return;
      if (serviceOwned) await deps.startService();
      else await deps.startOwned();
      for (let i = 0; i < 240; i++) {
        if (await deps.answers()) {
          stopped = false;
          return;
        }
        await deps.sleep(250);
      }
      throw new Error('The previous daemon could not restart.');
    },
  };
};
