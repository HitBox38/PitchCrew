import type { ChatMessage } from './chat.ts';
import type { Snapshot } from './workspace.ts';

export function isNotificationMessage(
  message: ChatMessage,
  data: Pick<Snapshot, 'conversations' | 'userInputs'>,
  notices: ReadonlySet<string>,
) {
  if (
    message.userInput?.kind === 'question' &&
    !data.userInputs?.some((q) => q.id === message.userInput?.id && q.status === 'pending')
  )
    return false;
  if (message.from === 'user' || message.from === 'system') return false;
  const conversation = data.conversations?.find((item) => item.id === message.threadId);
  if (!conversation || message.notification || notices.has(message.id) || conversation.notifyAll)
    return true;
  if (conversation.kind === 'history' || conversation.kind === 'agent_dm') return false;
  return (
    conversation.kind === 'direct' ||
    conversation.kind === 'routine' ||
    message.from === conversation.leadId
  );
}
