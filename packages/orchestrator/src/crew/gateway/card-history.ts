import { decodeEvent, historyReadQuery } from '@pitchcrew/core';
import type { Board } from '@pitchcrew/board';
import { jsonBytes, readField, readPageBytes } from './read-pages.ts';

export const readCardHistory = (board: Board, cardId: string, data: unknown) => {
  const { eventId, beforeEventId, limit, field, cursor } = historyReadQuery.parse(data);
  if (eventId) {
    const row = board.db
      .prepare(
        "SELECT json FROM events WHERE id = ? AND json_extract(json,'$.entityId') = ? AND json_extract(json,'$.kind') = 'card'",
      )
      .get(eventId, cardId) as { json: string } | undefined;
    if (!row) throw new Error('Card event not found.');
    return readField({ ...decodeEvent(row.json), id: eventId }, field ?? 'data', cursor);
  }
  if (field || cursor) throw new Error('Choose an eventId to read an event field.');
  // Project the timeline in SQLite. Each event's data may hold the entire captured job page.
  const rows = board.db
    .prepare(`
    SELECT id, json_extract(json,'$.version') AS version, json_extract(json,'$.createdAt') AS createdAt,
      substr(json_extract(json,'$.actor'), 1, 128) AS actor,
      substr(CAST(json_extract(json,'$.message') AS BLOB), 1, 1604) AS messagePrefix,
      json_extract(json,'$.data.state') AS state
    FROM events WHERE json_extract(json,'$.entityId') = ? AND json_extract(json,'$.kind') = 'card'
      AND id < ? ORDER BY id DESC LIMIT ?
  `)
    .all(cardId, beforeEventId ?? Number.MAX_SAFE_INTEGER, limit + 1) as {
    id: number;
    version: number;
    createdAt: string;
    actor: string;
    messagePrefix: Uint8Array;
    state: string;
  }[];
  const events = [];
  let bytes = 100;
  for (const { state, messagePrefix, ...row } of rows.slice(0, limit)) {
    // SQLite text substr stops at a NUL. A 401-code-point UTF-8 prefix fits in 1604 bytes.
    const characters = Array.from(Buffer.from(messagePrefix).toString('utf8'));
    const event = {
      ...row,
      message: characters.slice(0, 400).join(''),
      kind: 'card',
      entityId: cardId,
      data: { state },
      ...(characters.length > 400 ? { messageTruncated: true } : {}),
    };
    bytes += jsonBytes(event) + 1;
    if (bytes > readPageBytes) break;
    events.push(event);
  }
  return { events, nextCursor: rows.length > events.length ? events.at(-1)!.id : null };
};
