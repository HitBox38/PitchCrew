import { setup as setupDaemon } from '../../../orchestrator/test/helpers/daemon.ts';

export {
  cleanup,
  confirmFixtureApplication,
  directorySkill,
  finish,
} from '../../../orchestrator/test/helpers/daemon.ts';

/** Full-app browser suites share one production UI build instead of Vite servers. */
export const setup = (
  port: number,
  seedSkills = false,
  options: Parameters<typeof setupDaemon>[2] = {},
) => setupDaemon(port, seedSkills, { ...options, ui: 'built' });
