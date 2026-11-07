import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ChatRequest, ChatSubmissionReceipt } from '@pitchcrew/core';
import { conversation } from './conversations.ts';
import type { CrewContext } from './types.ts';

const pending = new WeakMap<
  CrewContext,
  Map<string, { digest: string; result: Promise<ChatRequest> }>
>();

export const chatSubmissionReceipt = (context: CrewContext, threadId: string, id: string) => {
  conversation(context, threadId);
  z.uuid().parse(id);
  const row = context.board.db
    .prepare(
      "SELECT json FROM entities WHERE kind='chat_request' AND json_extract(json,'$.threadId')=? AND json_extract(json,'$.submission.id')=?",
    )
    .get(threadId, id) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as ChatRequest) : null;
};

/** Reconciliation needs acceptance identity rather than the saved request payload or digest. */
export const chatSubmissionIdentity = (
  context: CrewContext,
  threadId: string,
  id: string,
): ChatSubmissionReceipt | null => {
  conversation(context, threadId);
  z.uuid().parse(id);
  const row = context.board.db
    .prepare(
      "SELECT id FROM entities WHERE kind='chat_request' AND json_extract(json,'$.threadId')=? AND json_extract(json,'$.submission.id')=?",
    )
    .get(threadId, id) as { id: string } | undefined;
  return row ? { id: row.id, threadId, submission: { id } } : null;
};

/** Coalesce concurrent retries before any async work; the request itself is the durable receipt. */
export const submitChatOnce = async (
  context: CrewContext,
  threadId: string,
  id: string | undefined,
  payload: unknown,
  send: (submission?: ChatRequest['submission']) => Promise<ChatRequest>,
): Promise<ChatRequest> => {
  if (!id) return send();
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const saved = chatSubmissionReceipt(context, threadId, id);
  const inflight = pending.get(context) ?? new Map();
  pending.set(context, inflight);
  const key = `${threadId}:${id}`;
  const existing = inflight.get(key);
  if ((saved && saved.submission?.digest !== digest) || (existing && existing.digest !== digest))
    throw Object.assign(
      new Error(
        'This send ID was already used for a different message. Restore the original message or start a new send.',
      ),
      { statusCode: 409 },
    );
  if (saved) return saved;
  if (existing) return existing.result;
  // Defer execution until the promise is registered, including synchronous failures.
  const result = Promise.resolve().then(() => send({ id, digest }));
  inflight.set(key, { digest, result });
  try {
    return await result;
  } finally {
    inflight.delete(key);
  }
};
