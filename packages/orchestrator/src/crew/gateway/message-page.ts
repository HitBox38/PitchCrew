import type { ChatMessage } from '@pitchcrew/core';
import { jsonBytes, readPageBytes } from './read-pages.ts';

const previewMessage = (message: ChatMessage) => {
  const { id, threadId, from, to, createdAt, cardId, runId, content, ...extra } = message;
  const preview =
    content.length > 500 ? content.slice(0, 500).replace(/[\uD800-\uDBFF]$/u, '') : content;
  return {
    id,
    threadId,
    from,
    to,
    createdAt,
    cardId,
    runId,
    content: preview,
    truncated: true,
    omittedFields: [...(preview.length < content.length ? ['content'] : []), ...Object.keys(extra)],
  };
};

export const messagePage = (
  messages: ChatMessage[],
  beforeId: string | undefined,
  limit: number,
) => {
  const end = beforeId ? messages.findIndex((item) => item.id === beforeId) : messages.length;
  if (end < 0) throw new Error('Message cursor not found.');
  const page = [];
  // Leave room for the message array and its continuation ID.
  let bytes = 200;
  for (let i = end - 1; i >= Math.max(0, end - limit); i--) {
    const message = messages[i]!;
    const size = jsonBytes(message) + 1;
    const item = size > readPageBytes - 200 ? previewMessage(message) : message;
    bytes += item === message ? size : jsonBytes(item) + 1;
    if (bytes > readPageBytes) break;
    page.push(item);
  }
  page.reverse();
  return { messages: page, beforeId: end > page.length ? page[0]!.id : null };
};
