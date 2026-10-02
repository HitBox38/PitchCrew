import type { ChatViewModel } from '@/ChatView/types.ts';

export type JobContextSelectProps = Pick<
  ChatViewModel,
  'cardId' | 'jobItems' | 'busy' | 'working' | 'setJobs' | 'thread' | 'attached'
>;

export type RecipientSelectProps = Pick<
  ChatViewModel,
  'recipient' | 'recipientItems' | 'working' | 'setRecipient'
>;
