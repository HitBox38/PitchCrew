import type { ChatMessage, ConversationHistoryPage, Run } from '@pitchcrew/core';
import type { Board } from '../index.ts';

const pageSize = 50;
interface Entry {
  kind: 'message' | 'turn';
  id: string;
  createdAt: string;
  rank: number;
}
interface MessageIndex {
  id: string;
  createdAt: string;
  sender: string;
  runId: string | null;
}

/** Index transcript positions without parsing saved message bodies or run configurations. */
export function conversationHistory(
  board: Board,
  thread: string,
  anchor?: string,
): ConversationHistoryPage {
  const messages = board.db
    .prepare(`SELECT id, json_extract(json,'$.createdAt') AS createdAt,
    json_extract(json,'$.from') AS sender, json_extract(json,'$.runId') AS runId
    FROM entities WHERE kind='message' AND json_extract(json,'$.threadId')=? ORDER BY rowid`)
    .all(thread) as MessageIndex[];
  const triggers = new Map<string, string>();
  const entries: Entry[] = messages.map((m) => {
    const user = m.sender === 'user' || m.sender === 'system';
    if (user && m.runId && !triggers.has(m.runId)) triggers.set(m.runId, m.createdAt);
    return { kind: 'message', id: m.id, createdAt: m.createdAt, rank: user ? 0 : 2 };
  });
  const runs = board.db
    .prepare(`SELECT id, json_extract(json,'$.startedAt') AS startedAt
    FROM entities WHERE kind='run' AND json_extract(json,'$.threadId')=?
    AND json_extract(json,'$.mode')='chat'
    AND (json_array_length(json,'$.activity')>0 OR json_extract(json,'$.status')='running') ORDER BY rowid DESC`)
    .all(thread) as { id: string; startedAt: string }[];
  for (const run of runs)
    entries.push({
      kind: 'turn',
      id: `turn-${run.id}`,
      createdAt: triggers.get(run.id) ?? run.startedAt,
      rank: 1,
    });
  entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.rank - b.rank);
  const found = anchor ? entries.findIndex((item) => item.id === anchor) : -1;
  const start = found < 0 ? Math.max(0, entries.length - pageSize) : found;
  const end = Math.min(entries.length, start + pageSize);
  return {
    start,
    end,
    total: entries.length,
    older: start > 0 ? entries[Math.max(0, start - pageSize)].id : null,
    newer: end < entries.length ? entries[end].id : null,
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
            run: visibleRun(board.get<Run>('run', item.id.slice(5))),
          },
    ),
  };
}
function visibleRun(run: Run): Run {
  const { configuration: _configuration, ...visible } = run;
  return visible;
}

/** Search every saved message and attachment, without retaining their bodies in the renderer. */
export function searchConversationMessages(board: Board, query: string): string[] {
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
}
