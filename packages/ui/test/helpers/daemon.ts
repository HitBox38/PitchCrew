import { setup as setupDaemon } from '../../../orchestrator/test/helpers/daemon.ts';

export {
  cleanup,
  confirmFixtureApplication,
  directorySkill,
  finish,
} from '../../../orchestrator/test/helpers/daemon.ts';

/** Full-app browser suites share one production UI build instead of Vite servers. */
export const setup = (seedSkills = false, options: Parameters<typeof setupDaemon>[1] = {}) =>
  setupDaemon(seedSkills, { ...options, ui: 'built' });
