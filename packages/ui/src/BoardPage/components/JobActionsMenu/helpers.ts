import type { Card, CardState, Snapshot } from '@pitchcrew/core';
import { workflowSeat } from '@pitchcrew/core/states';
import type { CrewShortcut } from './types.ts';

export const shortcutLabels: Partial<Record<CardState, string>> = {
  shortlisted: 'Shortlist',
  submitted: 'Mark submitted',
  screening: 'Record screening',
  interviewing: 'Record interview',
  offer: 'Record offer',
  rejected: 'Mark rejected',
  ghosted: 'Mark no response',
  withdrawn: 'Mark withdrawn',
};

export function quickStatuses(state: CardState): CardState[] {
  switch (state) {
    case 'lead':
      return ['shortlisted', 'withdrawn'];
    case 'submitted':
      return ['screening', 'interviewing', 'offer', 'rejected', 'ghosted', 'withdrawn'];
    case 'screening':
      return ['interviewing', 'offer', 'rejected', 'ghosted', 'withdrawn'];
    case 'interviewing':
      return ['offer', 'rejected', 'ghosted', 'withdrawn'];
    case 'offer':
      return ['rejected', 'withdrawn'];
    case 'rejected':
    case 'withdrawn':
    case 'ghosted':
      return [];
    default:
      return ['submitted', 'withdrawn'];
  }
}

export function crewShortcut(card: Card, data: Snapshot): CrewShortcut | null {
  const run = data.runs.find((run) => run.cardId === card.id && run.status === 'running');
  if (run) return { label: 'Cancel run', runId: run.id };
  const seat =
    card.state === 'lead'
      ? 'scout'
      : ['shortlisted', 'changes_requested'].includes(card.state)
        ? 'writer'
        : ['in_review', 'agreed', 'awaiting_approval'].includes(card.state)
          ? 'reviewer'
          : null;
  if (!seat) return null;
  const label =
    seat === 'scout' ? 'Evaluate fit' : seat === 'writer' ? 'Draft application' : 'Review packet';
  const role = data.roles.find(
    (role) => role.enabled && !role.retiredAt && workflowSeat(role) === seat,
  );
  const base = { label, roleId: role?.id, draft: seat === 'writer' };
  if (card.owner) return { ...base, reason: 'Wait for this job’s active work to finish.' };
  if (!role) return { ...base, reason: `Enable an agent in the ${seat} seat in Crew.` };
  if (!['demo', 'codex', 'claude-code', 'opencode'].includes(role.runtime))
    return { ...base, reason: 'Choose a runtime that supports isolated application work in Crew.' };
  if (!data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available))
    return { ...base, reason: 'Install this agent’s runtime in Settings.' };
  if (!data.profile.some((note) => note.content.trim()))
    return { ...base, reason: 'Add your profile notes before starting the crew.' };
  if (seat === 'reviewer' && !card.packet)
    return { ...base, reason: 'There is no application packet to review yet.' };
  const context = card.applicationContext;
  return {
    ...base,
    needsBrief:
      !context ||
      (seat !== 'scout' &&
        (!context.confirmedAt || context.confirmedRevision !== context.revision)),
  };
}
