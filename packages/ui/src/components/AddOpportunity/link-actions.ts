import type { Snapshot } from '@pitchcrew/core';
import { maxJobLinkLength, recognizeJobLink } from '@pitchcrew/core/job-link-recognition';
import { recognizePublicJobLink } from '@pitchcrew/core/public-job-links';
import { workflowSeat } from '@pitchcrew/core/states';

/** Choose the action without making a request or starting an agent. */
export function jobLinkAction(value: string): 'fetch' | 'scout' | 'invalid' {
  const raw = value.trim();
  if (!raw || raw.length > maxJobLinkLength || /\s/.test(raw)) return 'invalid';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port)
      return 'invalid';
  } catch {
    return 'invalid';
  }
  return recognizeJobLink(raw).recognized || recognizePublicJobLink(raw) ? 'fetch' : 'scout';
}

export function scoutJobTarget(data: Pick<Snapshot, 'roles' | 'runtimes'>) {
  const scouts = data.roles.filter((role) => !role.retiredAt && workflowSeat(role) === 'scout');
  const enabled = scouts.filter((role) => role.enabled);
  const permitted = enabled.filter((role) => role.capabilities?.discoverJobs);
  const role = permitted.find((role) =>
    data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available),
  );
  const blocker = !enabled.length
    ? 'Enable a Scout agent in Crew to add jobs from other links.'
    : !permitted.length
      ? 'Enable “Scan saved job sources and add or update jobs from links” for Scout in Crew.'
      : !role
        ? 'Install Scout’s runtime in Settings to ask Scout to add this job.'
        : '';
  return { role, blocker };
}

export const scoutJobPrompt = (url: string) =>
  `Add this job to my board from its posting link:\n${url.trim()}\n\nUse the job-link import tool to read the posting and add it as a lead. If it is already on the board, show me the existing job instead. If you cannot read it, ask me for the posting text. Do not shortlist, apply or submit.`;
