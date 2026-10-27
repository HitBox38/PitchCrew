import type { CardState, Snapshot } from '@pitchcrew/core';
import { stateLabels } from '../lib/labels.ts';

export interface PendingJobAction {
  cardId: string;
  path: string;
  label: string;
  targetState?: CardState;
}
/** Resolve before the first await so every job surface acknowledges the same click. */
export const pendingJobAction = (
  path: string,
  method: string,
  body: unknown,
  data: Snapshot | null,
): PendingJobAction | null => {
  if (method === 'GET') return null;
  const input = body as { cardId?: string; state?: CardState } | undefined;
  const cardPath = /^\/cards\/([^/]+)\/(.+)$/.exec(path);
  const cancelledRun = /^\/runs\/([^/]+)\/cancel$/.exec(path);
  const cardId =
    cardPath?.[1] ??
    (path === '/queue/actions' ? input?.cardId : undefined) ??
    (cancelledRun ? data?.runs.find((run) => run.id === cancelledRun[1])?.cardId : null);
  if (!cardId) return null;
  const operation = cardPath?.[2];
  const targetState = operation === 'move' || operation === 'status' ? input?.state : undefined;
  const label = targetState
    ? `Moving to ${stateLabels[targetState]}…`
    : cancelledRun
      ? 'Stopping agent…'
      : operation === 'application-context/extract'
        ? 'Starting source extraction…'
        : path === '/queue/actions' || operation === 'run'
          ? 'Starting agent…'
          : 'Saving job…';
  return { cardId, path, label, targetState };
};
