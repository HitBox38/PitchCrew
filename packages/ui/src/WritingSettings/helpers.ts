import type { Action } from '@/WorkspaceStore/index.ts';

/**
 * One change to the shared writing guide, sent through `action` with the guide revision it was
 * made against (the daemon refuses a stale one). Settings and Home both decide suggestions here,
 * so neither spells the endpoint.
 */
export const guideChange =
  (action: Action, revision: number | undefined) => (data: Record<string, unknown>) =>
    action('/quality', 'POST', { revision, ...data }, 'Writing guide updated');
