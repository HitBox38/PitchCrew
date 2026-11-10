import type {
  ConversationHistoryPage,
  ChatMessage,
  Run,
  ChatRequest,
  AgentTask,
} from '@pitchcrew/core';
import { transcriptItems, type TranscriptItem } from '../ChatTurn/helpers.ts';
import { historyWindow } from './history.ts';

export const liveHistoryItems = (
  page: ConversationHistoryPage,
  streaming: ChatMessage[],
  runs: Run[],
  thread: string,
  context: { requests?: ChatRequest[]; tasks?: AgentTask[] } = {},
): TranscriptItem[] => {
  const existing = new Map(page.items.map((item) => [item.id, item]));
  const pageRuns = new Map(
    page.items.flatMap((item) => (item.kind === 'turn' ? [[item.run.id, item.run] as const] : [])),
  );
  for (const run of runs) {
    const previous = pageRuns.get(run.id);
    if (previous)
      pageRuns.set(run.id, { ...previous, ...run, activity: run.activity ?? previous.activity });
    else if (['running', 'waiting'].includes(run.status)) pageRuns.set(run.id, run);
  }
  const messages = page.items.flatMap((item) => (item.kind === 'message' ? [item.message] : []));
  const saved = new Set(messages.map((message) => message.id));
  const liveMessages = [
    ...messages,
    ...streaming.filter((message) => message.threadId === thread && !saved.has(message.id)),
  ];
  const items = transcriptItems(liveMessages, [...pageRuns.values()], thread, {
    ...context,
    positions: new Map(page.items.map((item) => [item.id, item.createdAt])),
    dispatchRuns: [...runs, ...pageRuns.values()],
  }).map((item) =>
    item.kind === 'turn' &&
    !liveMessages.some(
      (message) =>
        message.runId === item.run.id &&
        message.from === item.run.roleId &&
        !message.notification &&
        !message.userInput,
    )
      ? { ...item, createdAt: existing.get(item.id)?.createdAt ?? item.createdAt }
      : item,
  );
  return historyWindow(items, null).items;
};

/**
 * What the reader has seen on the latest page stays put. Entries above the newest window stay
 * until the reader navigates, so the window dropping its oldest entry (or a refetched page drawing
 * the cut differently) never shifts the transcript. Until the next saved page arrives
 * (`untilRefetch`), entries that leave the live data stay too: a finished reply leaves the stream,
 * and a finished turn the live runs, before the refetched page brings their saved copies.
 */
export const keepShownItems = (
  shown: TranscriptItem[],
  items: TranscriptItem[],
  untilRefetch: boolean,
) => {
  const ids = new Set(items.map((item) => item.id));
  if (!shown.some((item) => ids.has(item.id))) return items;
  const result: TranscriptItem[] = [];
  const placed = new Set<string>();
  let next = 0;
  for (const item of shown) {
    if (!ids.has(item.id)) {
      if (untilRefetch || !placed.size) result.push(item);
      continue;
    }
    while (next < items.length && !placed.has(item.id)) {
      const entry = items[next++];
      result.push(entry);
      placed.add(entry.id);
    }
  }
  result.push(...items.slice(next));
  return result.length === items.length ? items : result;
};
