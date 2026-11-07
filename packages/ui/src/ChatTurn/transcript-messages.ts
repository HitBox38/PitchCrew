import type { AgentTask, ChatMessage, ChatRequest } from '@pitchcrew/core';
import { hiddenTranscriptMessageIds } from '@pitchcrew/core/transcript-visibility';

/** A group @mention forwards an already-visible final reply to a task recipient. */
export const visibleTranscriptMessages = (
  messages: ChatMessage[],
  requests: ChatRequest[] = [],
  tasks: AgentTask[] = [],
  startedRequestIds: ReadonlySet<string> = new Set(),
) => {
  const hidden = hiddenTranscriptMessageIds(
    messages.map((message) => ({
      id: message.id,
      threadId: message.threadId,
      sender: message.from,
      recipient: message.to,
      runId: message.runId,
      content: message.content,
      createdAt: message.createdAt,
      referencesKey: JSON.stringify(message.references ?? []),
      hasAttachments: !!message.attachments?.length,
      hasUserInput: !!message.userInput,
      hasNotification: !!message.notification,
    })),
    tasks,
    requests,
    startedRequestIds,
  );
  return messages.filter((message) => !hidden.has(message.id));
};
