import type { ChatViewModel } from '@/ChatView/types.ts';

export type RecipientSelectProps = Pick<
  ChatViewModel,
  'recipient' | 'recipientItems' | 'working' | 'setRecipient'
>;
