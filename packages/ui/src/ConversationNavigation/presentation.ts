import type { ConversationNavigationRow } from './types.ts';
export const conversationPreview = (row: ConversationNavigationRow) => {
  if (row.failed) return 'A message failed · retry or remove it';
  if (row.waitingForUser) return 'Waiting for you';
  if (row.working) return 'Working…';
  if (row.waiting) return 'Waiting for an agent';
  return row.preview;
};
