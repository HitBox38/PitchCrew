import type { Snapshot } from '@pitchcrew/core';
import type { ConversationNavigationRow } from './types.ts';
export function conversationRows(
  data: Snapshot,
  query: string,
  includeArchived: boolean,
  readAt: Record<string, string>,
): ConversationNavigationRow[] {
  const needle = query.trim().toLowerCase();
  const roles = new Map(data.roles.map((role) => [role.id, role.name]));
  const messages = new Map<string, { preview: string; unread: boolean }>();
  const matchingThreads = new Set<string>();
  for (const message of data.messages) {
    if (
      needle &&
      `${message.content} ${message.attachments?.map((file) => file.name).join(' ') ?? ''}`
        .toLowerCase()
        .includes(needle)
    )
      matchingThreads.add(message.threadId);
    const previous = messages.get(message.threadId);
    messages.set(message.threadId, {
      preview: `${message.from === 'user' ? 'You: ' : ''}${message.content || 'Attachment'}`,
      unread:
        !!previous?.unread ||
        (message.from !== 'user' && message.createdAt > (readAt[message.threadId] ?? '')),
    });
  }
  const working = new Set(
    data.runs.filter((run) => run.status === 'running').map((run) => run.threadId),
  );
  const waiting = new Set(
    data.chatRequests
      ?.filter((request) => request.deliveries.some((delivery) => delivery.status === 'queued'))
      .map((request) => request.threadId),
  );
  return (data.conversations ?? [])
    .filter(
      (item) =>
        (includeArchived || !item.archived) &&
        (!needle ||
          matchingThreads.has(item.id) ||
          `${item.title} ${item.participants.map((id) => roles.get(id) ?? id).join(' ')}`
            .toLowerCase()
            .includes(needle)),
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
    .map((conversation) => ({
      conversation,
      preview:
        messages.get(conversation.id)?.preview ??
        (conversation.kind === 'agent_dm'
          ? 'Agent collaboration · read-only'
          : conversation.kind === 'history'
            ? 'Previous crew messages · read-only'
            : 'Start a conversation'),
      unread: messages.get(conversation.id)?.unread ?? false,
      working: working.has(conversation.id),
      waiting: waiting.has(conversation.id),
      waitingForUser:
        data.userInputs?.some((q) => q.threadId === conversation.id && q.status === 'pending') ??
        false,
    }));
}
