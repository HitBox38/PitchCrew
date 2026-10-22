import type { Role, Snapshot } from '@pitchcrew/core';
export const submissionAgentProblem = (role: Role | undefined, data: Snapshot) => {
  if (!role || role.retiredAt)
    return 'Submitter is unavailable. Restore it in Crew or choose another eligible agent.';
  if (!role.enabled) return `${role.name} is paused. Enable it in Crew before starting.`;
  if (
    !role.capabilities?.computerUse ||
    !role.capabilities?.assessForms ||
    !role.capabilities?.recordSubmissions
  )
    return 'Enable browser access, form assessments and submission receipts for this agent in Crew.';
  if (!data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available))
    return 'Install and configure this agent’s runtime in Settings.';
  return '';
};
