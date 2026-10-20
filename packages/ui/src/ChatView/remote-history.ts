import type { ConversationHistoryPage, ChatMessage, Run } from '@pitchcrew/core';
import { transcriptItems, type TranscriptItem } from '../ChatTurn/helpers.ts';
import { HISTORY_PAGE_SIZE } from './history.ts';

export const liveHistoryItems = (
  page: ConversationHistoryPage,
  streaming: ChatMessage[],
  runs: Run[],
  thread: string,
): TranscriptItem[] => {
  const existing = new Map(page.items.map((item) => [item.id, item]));
  const pageRuns = new Map(
    page.items.flatMap((item) => (item.kind === 'turn' ? [[item.run.id, item.run] as const] : [])),
  );
  for (const run of runs)
    if ((pageRuns.has(run.id) && run.activity !== undefined) || run.status === 'running')
      pageRuns.set(run.id, run);
  const messages = page.items.flatMap((item) => (item.kind === 'message' ? [item.message] : []));
  const saved = new Set(messages.map((message) => message.id));
  return transcriptItems(
    [
      ...messages,
      ...streaming.filter((message) => message.threadId === thread && !saved.has(message.id)),
    ],
    [...pageRuns.values()],
    thread,
  )
    .map((item) => ({ ...item, createdAt: existing.get(item.id)?.createdAt ?? item.createdAt }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || rank(a) - rank(b))
    .slice(-HISTORY_PAGE_SIZE);
};
const rank = (item: TranscriptItem) =>
  item.kind === 'turn' ? 1 : item.message.from === 'user' || item.message.from === 'system' ? 0 : 2;
