import type { Conversation } from '@pitchcrew/core';
export interface ConversationNavigationRow {
  conversation: Conversation;
  preview: string;
  unread: boolean;
  working: boolean;
  waiting: boolean;
  waitingForUser: boolean;
}
