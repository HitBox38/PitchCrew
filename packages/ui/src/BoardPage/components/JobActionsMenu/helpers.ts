import { statusActionLabels } from '@/lib/labels.ts';
import { cardLifecycle } from '@pitchcrew/core/lifecycles';
import type { Card, CardState, Snapshot } from '@pitchcrew/core';
import { workflowSeat } from '@pitchcrew/core/states';
import { isolatesApplications } from '@/lib/runtimes.ts';
import type { CrewShortcut } from './types.ts';

export const quickStatuses = (state: CardState): CardState[] => {
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
};

type Seat = 'scout' | 'writer' | 'reviewer';

/** The enabled, unretired agent in a workflow seat. */
const seatRole = (seat: Seat, data: Pick<Snapshot, 'roles'>) =>
  data.roles.find((role) => role.enabled && !role.retiredAt && workflowSeat(role) === seat);

/**
 * Why no job can start this seat's work now, the same for every job, so a batch checks it once:
 * no enabled agent in the seat (the server refuses it when queuing), a runtime that cannot isolate
 * application work, an unavailable runtime or empty profile notes (the server accepts these and
 * holds the request when it starts). Empty when the seat is ready.
 */
export const seatBlocker = (
  seat: Seat,
  data: Pick<Snapshot, 'roles' | 'runtimes' | 'profile'>,
): string => {
  const role = seatRole(seat, data);
  if (!role) return `Enable an agent in the ${seat} seat in Crew.`;
  if (!isolatesApplications(data.runtimes, role.runtime))
    return 'Choose a runtime that supports isolated application work in Crew.';
  if (!data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available))
    return 'Install this agent’s runtime in Settings.';
  if (!data.profile.some((note) => note.content.trim()))
    return 'Add your profile notes before starting the crew.';
  return '';
};

export const crewShortcut = (card: Card, data: Snapshot): CrewShortcut | null => {
  const run = data.runs.find((run) => run.cardId === card.id && run.status === 'running');
  if (run) return { label: 'Cancel run', runId: run.id };
  const seat =
    card.state === 'lead'
      ? 'scout'
      : cardLifecycle.is('draftable', card.state)
        ? 'writer'
        : cardLifecycle.is('reviewable', card.state)
          ? 'reviewer'
          : null;
  if (!seat) return null;
  const label =
    seat === 'scout' ? 'Evaluate fit' : seat === 'writer' ? 'Draft application' : 'Review packet';
  const role = seatRole(seat, data);
  const base = { label, roleId: role?.id, draft: seat === 'writer' };
  // The job's own work is reported before any workspace-wide reason.
  if (card.owner) return { ...base, reason: 'Wait for this job’s active work to finish.' };
  const blocker = seatBlocker(seat, data);
  if (blocker) return { ...base, reason: blocker };
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
};

/** Status changes as actions; shared with the job sheet's Change… menu. */
export const shortcutLabels = statusActionLabels;
