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
