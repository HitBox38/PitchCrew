import { useSkillUpdateChecks } from './hooks/useSkillUpdateChecks.ts';

/** Workspace-owned maintenance stays mounted independently of routes and sidebar drawers. */
export const AgentUpdates = () => {
  useSkillUpdateChecks();
  return null;
};
