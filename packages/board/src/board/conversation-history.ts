import {
  compactRun,
  transcriptOrder,
  transcriptWindow,
  type ChatMessage,
  type ConversationHistoryPage,
  type Run,
  type TranscriptRunPosition,
} from '@pitchcrew/core';
import { conversationTranscriptIndex } from './transcript-messages.ts';
import type { Board } from '../index.ts';

/** Index transcript positions without parsing saved message bodies or run configurations. */
export const conversationHistory = (
  board: Board,
  thread: string,
  anchor?: string,
): ConversationHistoryPage => {
  const runs = board.db
    .prepare(`SELECT id, json_extract(json,'$.startedAt') AS startedAt,
    json_extract(json,'$.roleId') AS roleId, json_extract(json,'$.status') AS status,
    json_extract(json,'$.requestId') AS requestId,
    (json_array_length(json,'$.activity')>0 OR json_extract(json,'$.status') IN ('running','waiting','failed','cancelled')) AS displayed
    FROM entities WHERE kind='run' AND json_extract(json,'$.threadId')=?
    AND json_extract(json,'$.mode') IN ('chat','workflow')
    AND COALESCE(json_extract(json,'$.reviewSeatReservation'),0)=0 ORDER BY rowid`)
    .all(thread) as (TranscriptRunPosition & { displayed: number | null })[];
  const startedRequests = new Set(runs.flatMap((run) => (run.requestId ? [run.requestId] : [])));
  const { messages, hidden, requests } = conversationTranscriptIndex(
    board,
    thread,
    startedRequests,
  );
  const entries = transcriptOrder(
    messages.filter((message) => !hidden.has(message.id)),
    runs.filter((run) => run.displayed),
    { requests, dispatchRuns: runs },
  );
  const { start, end, older, newer } = transcriptWindow(
    entries,
    anchor ?? null,
    50,
    (previous, current) =>
      previous.kind === 'turn' &&
      current.kind === 'message' &&
      previous.runId === current.runId &&
      previous.createdAt === current.createdAt,
  );
  return {
    start,
    end,
    total: entries.length,
    older,
    newer,
    items: entries.slice(start, end).map((item) =>
      item.kind === 'message'
        ? {
            kind: 'message',
            id: item.id,
            createdAt: item.createdAt,
            message: board.get<ChatMessage>('message', item.id),
          }
        : {
            kind: 'turn',
            id: item.id,
            createdAt: item.createdAt,
            run: compactRun(board.get<Run>('run', item.id.slice(5))),
          },
    ),
  };
};

/** Search every saved message and attachment, without retaining their bodies in the renderer. */
export const searchConversationMessages = (board: Board, query: string): string[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const matches = new Set<string>();
  const rows = board.db.prepare(`SELECT json_extract(json,'$.threadId') AS thread,
    json_extract(json,'$.content') AS content, json_extract(json,'$.attachments') AS attachments
    FROM entities WHERE kind='message'`);
  for (const row of rows.iterate() as Iterable<{
    thread: string;
    content: string;
    attachments: string | null;
  }>) {
    if (matches.has(row.thread)) continue;
    const files = row.attachments ? (JSON.parse(row.attachments) as { name: string }[]) : [];
    if (`${row.content} ${files.map((file) => file.name).join(' ')}`.toLowerCase().includes(needle))
      matches.add(row.thread);
  }
  return [...matches];
};
