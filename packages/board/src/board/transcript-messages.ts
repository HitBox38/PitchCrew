import type { Board } from '../index.ts';
import type {
  TranscriptMessagePosition,
  TranscriptRequestPosition,
} from '@pitchcrew/core/transcript-order';
import {
  hiddenTranscriptMessageIds,
  type TranscriptVisibilityMessage,
  type TranscriptVisibilityTask,
} from '@pitchcrew/core/transcript-visibility';

/** One bounded thread projection; neither message JSON bodies nor run configurations are parsed. */
export const conversationTranscriptIndex = (
  board: Board,
  thread: string,
  startedRequestIds: ReadonlySet<string> = new Set(),
) => {
  const messages = board.db
    .prepare(`SELECT id,
    json_extract(json,'$.threadId') AS threadId,
    json_extract(json,'$.from') AS sender, json_extract(json,'$.to') AS recipient,
    json_extract(json,'$.runId') AS runId, json_extract(json,'$.content') AS content,
    json_extract(json,'$.createdAt') AS createdAt,
    COALESCE(json_extract(json,'$.references'),'[]') AS referencesKey,
    COALESCE(json_array_length(json,'$.attachments'),0)>0 AS hasAttachments,
    json_extract(json,'$.userInput.kind') AS userInput,
    json_extract(json,'$.notification') AS notification,
    json_extract(json,'$.userInput') IS NOT NULL AS hasUserInput,
    json_extract(json,'$.notification') IS NOT NULL AS hasNotification
    FROM entities WHERE kind='message' AND json_extract(json,'$.threadId')=? ORDER BY rowid`)
    .all(thread) as (TranscriptVisibilityMessage & TranscriptMessagePosition)[];
  const tasks = board.db
    .prepare(`SELECT json_extract(json,'$.parentRunId') AS parentRunId,
    json_extract(json,'$.threadId') AS threadId, json_extract(json,'$.roleId') AS roleId,
    json_extract(json,'$.trigger') AS trigger, json_extract(json,'$.content') AS content
    FROM entities WHERE kind='task' AND json_extract(json,'$.threadId')=?`)
    .all(thread) as TranscriptVisibilityTask[];
  const requests = (
    board.db
      .prepare(`SELECT id, json_extract(json,'$.messageId') AS messageId,
    (SELECT json_group_array(json_object('runId',json_extract(value,'$.runId'),
      'status',json_extract(value,'$.status'))) FROM json_each(entities.json,'$.deliveries'))
      AS deliveriesJson
    FROM entities WHERE kind='chat_request' AND json_extract(json,'$.threadId')=?`)
      .all(thread) as { id: string; messageId: string; deliveriesJson: string }[]
  ).map(
    (row) =>
      ({
        id: row.id,
        messageId: row.messageId,
        deliveries: JSON.parse(row.deliveriesJson) as { runId: string | null; status: string }[],
      }) satisfies TranscriptRequestPosition,
  );
  return {
    messages,
    requests,
    hidden: hiddenTranscriptMessageIds(messages, tasks, requests, startedRequestIds),
  };
};

/** Compatibility for callers needing only exclusions; records and task delivery stay untouched. */
export const hiddenTranscriptMessages = (board: Board, thread: string) =>
  conversationTranscriptIndex(board, thread).hidden;
