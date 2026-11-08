import type { Snapshot } from '@pitchcrew/core';
import { maxJobLinkLength, recognizeJobLink } from '@pitchcrew/core/job-link-recognition';
import { recognizePublicJobLink } from '@pitchcrew/core/public-job-links';
import { workflowSeat } from '@pitchcrew/core/states';

/** Choose the action without making a request or starting an agent. */
export const jobLinkAction = (value: string): 'fetch' | 'scout' | 'invalid' => {
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
};

export const scoutJobTarget = (data: Pick<Snapshot, 'roles' | 'runtimes'>) => {
  const scouts = data.roles.filter((role) => !role.retiredAt && workflowSeat(role) === 'scout');
  const enabled = scouts.filter((role) => role.enabled);
  const permitted = enabled.filter((role) => role.capabilities?.discoverJobs);
  const available = permitted.filter((role) =>
    data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available),
  );
  const role = available.find((role) => role.capabilities?.computerUse) ?? available[0];
  const blocker = !enabled.length
    ? 'To ask Scout later, enable a Scout agent in Crew.'
    : !permitted.length
      ? 'To ask Scout later, turn on “Scan saved job sources and add or update jobs from links” in Scout’s settings in Crew.'
      : !role
        ? 'To ask Scout later, install Scout’s runtime in Settings > Runtimes.'
        : '';
  return { role, blocker };
};

/** Fallback text below the link field: manual entry always stays available. */
export const jobLinkHint = ({
  askScout,
  external,
  blocker,
}: {
  askScout: boolean;
  external: boolean;
  blocker: string;
}) => {
  if (!askScout) return 'Nothing is saved until you add it.';
  if (external)
    return 'Fill in this application yourself, or clear “Already applied” to ask Scout to add a lead.';
  if (blocker)
    return `Pitchcrew can’t import this posting automatically, but you can still enter the job details below and add it. ${blocker}`;
  return 'Scout opens this link in a new conversation and adds the job. Or fill in the form.';
};

export const scoutJobPrompt = (url: string) =>
  `Add this job to my board from its posting link:\n${url.trim()}\n\nOpen this link in your in-app browser and inspect the loaded posting using your computer tools, following the existing navigation approval flow. Then use the job-link import tool with the current inspected URL, browserDigest and extracted details to add it as a lead. If it is already on the board, show me the existing job instead. Try the browser before asking me for the posting text. If browser tools are disabled, explain how to enable them in Crew. Ask me to handle sign-in or CAPTCHA only if the page actually requires it; ask for text only if browser access is unavailable or the posting is still unreadable. Do not shortlist, apply or submit.`;
