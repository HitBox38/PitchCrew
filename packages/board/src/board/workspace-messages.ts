import {
  isNotificationMessage,
  type ChatMessage,
  type Conversation,
  type PipelineReview,
  type RoleProposal,
  type UserInputRequest,
  type WorkspaceMessages,
} from '@pitchcrew/core';
import type { Board } from '../index.ts';

/** Project small previews and the same latest 100 eligible notifications as the UI. */
export function workspaceMessages(board: Board): WorkspaceMessages {
  const rows = board.db
    .prepare(`SELECT json_extract(json,'$.threadId') AS thread,
    count(*) AS count, max(rowid) AS latest,
    max(CASE WHEN json_extract(json,'$.from') != 'user' THEN json_extract(json,'$.createdAt') ELSE '' END) AS incomingAt
    FROM entities WHERE kind='message' GROUP BY json_extract(json,'$.threadId')`)
    .all() as {
    thread: string;
    count: number;
    latest: number;
    incomingAt: string;
  }[];
  const get = board.db.prepare('SELECT json FROM entities WHERE rowid=?');
  const messages = rows.map((row) => {
    const message = JSON.parse((get.get(row.latest) as { json: string }).json) as ChatMessage;
    return { ...message, content: message.content.slice(0, 240) };
  });
  const data = {
    conversations: board.list<Conversation>('conversation'),
    userInputs: board.list<UserInputRequest>('user_input'),
  };
  const notices = new Set([
    ...board
      .list<RoleProposal>('proposal')
      .flatMap((p) => (p.noticeMessageId ? [p.noticeMessageId] : [])),
    ...board.list<PipelineReview>('pipeline_review').map((p) => p.noticeMessageId),
  ]);
  const notificationMessages: ChatMessage[] = [];
  const candidates = board.db.prepare(`SELECT id, json_set(json,'$.content','') AS json
    FROM entities WHERE kind='message' AND json_extract(json,'$.from') NOT IN ('user','system')
    ORDER BY json_extract(json,'$.createdAt') DESC, id`);
  for (const row of candidates.iterate() as Iterable<{ id: string; json: string }>) {
    if (!isNotificationMessage(JSON.parse(row.json) as ChatMessage, data, notices)) continue;
    notificationMessages.push(board.get<ChatMessage>('message', row.id));
    if (notificationMessages.length === 100) break;
  }
  const event = board.db.prepare('SELECT max(id) AS id FROM events').get() as { id: number };
  const changes = board.db.prepare('SELECT total_changes() AS n').get() as { n: number };
  return {
    messages,
    notificationMessages,
    messageHistory: {
      revision: `${event.id}:${changes.n}:${board.db.pragma('data_version', { simple: true })}`,
      threads: Object.fromEntries(
        rows.map((row) => [row.thread, { count: row.count, incomingAt: row.incomingAt }]),
      ),
    },
  };
}
