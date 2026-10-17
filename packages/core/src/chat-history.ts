import type { ChatMessage } from './chat.ts';
import type { Run } from './runs.ts';

export type TranscriptItem =
  | { kind: 'message'; id: string; createdAt: string; message: ChatMessage }
  | { kind: 'turn'; id: string; createdAt: string; run: Run };

export interface ConversationHistoryPage {
  items: TranscriptItem[];
  start: number;
  end: number;
  total: number;
  older: string | null;
  newer: string | null;
}
export interface WorkspaceMessages {
  /** Workspace mode supplies the latest preview per conversation; full text belongs to history pages. */
  messages: ChatMessage[];
  notificationMessages?: ChatMessage[];
  messageHistory?: {
    revision: string;
    threads: Record<string, { count: number; incomingAt: string }>;
  };
}
