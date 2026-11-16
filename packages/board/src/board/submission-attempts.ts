import type { SubmissionAttempt, SubmissionAttemptHistory } from '@pitchcrew/core';
import type { Board } from '../index.ts';

/** Read the durable projection, not the optional copy on a card. Caller authorizes card access. */
export const readSubmissionAttempts = (
  board: Board,
  cardId: string,
  offset: number,
  limit: number,
): SubmissionAttemptHistory => {
  const counts = board.db
    .prepare(
      `SELECT COUNT(*) AS total,
      COALESCE(MAX(json_extract(json, '$.status') = 'uncertain'), 0) AS uncertain
     FROM entities WHERE kind = 'submission_attempt' AND json_extract(json, '$.cardId') = ?`,
    )
    .get(cardId) as { total: number; uncertain: number };
  const rows = board.db
    .prepare(
      `SELECT json FROM entities
     WHERE kind = 'submission_attempt' AND json_extract(json, '$.cardId') = ?
     ORDER BY json_extract(json, '$.createdAt') DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .all(cardId, limit, offset) as { json: string }[];
  return {
    cardId,
    total: counts.total,
    nextOffset: offset + limit < counts.total ? offset + limit : null,
    hasUncertainAttempts: !!counts.uncertain,
    attempts: rows.map((row) => {
      const attempt = JSON.parse(row.json) as SubmissionAttempt;
      return {
        id: attempt.id,
        cardId: attempt.cardId,
        runId: attempt.runId,
        roleId: attempt.roleId,
        status: attempt.status,
        createdAt: attempt.createdAt,
        resolvedAt: attempt.resolvedAt ?? null,
        confirmation: {
          browserCaptured: !!attempt.confirmation,
          externalVerifiedAt: attempt.externalConfirmation?.verifiedAt ?? null,
        },
      };
    }),
  };
};
