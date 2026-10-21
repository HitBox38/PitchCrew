import type { ConversationNavigationRow } from './types.ts';
export const conversationPreview = (row: ConversationNavigationRow) => {
  if (row.waitingForUser) return 'Waiting for you';
  if (row.working) return 'Working…';
  if (row.waiting) return 'Waiting for an agent';
  return row.preview;
};
