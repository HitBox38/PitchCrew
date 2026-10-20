import { createHash } from 'node:crypto';
import { assertConfirmedContext } from '@pitchcrew/board';
import type { Card, DeepReview, ProfileFile, Run } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import type { LiveDeepReview } from './types.ts';
import { packetDigest } from '../pipeline/snapshots.ts';
import { readProfile } from '@pitchcrew/packet';
export const profileDigest = (profile: ProfileFile[]) => {
  return createHash('sha256')
    .update(JSON.stringify([...profile].sort((a, b) => a.name.localeCompare(b.name))))
    .digest('hex');
};
export const review = (context: CrewContext, id: string) => {
  return context.board.get<DeepReview>('deep_review', id);
};
export const updateReview = (
  context: CrewContext,
  id: string,
  patch: Partial<DeepReview>,
  message: string,
) => {
  const value = { ...review(context, id), ...patch, updatedAt: new Date().toISOString() };
  context.board.record('deep_review', value, value.reviewerId, message);
  const run = context.board.get<Run>('run', value.runId);
  if (run.status === 'running')
    context.board.record('run', { ...run, message }, value.reviewerId, message);
  context.publishChat(true);
  return value;
};
export const assertReviewCurrent = (context: CrewContext, live: LiveDeepReview) => {
  if (live.controller.signal.aborted || context.closing) throw new Error('Deep review cancelled.');
  if (Date.now() >= live.deadline.expiresAt)
    throw new Error('Pitchcrew stopped the deep review at its shared deadline.');
  if (context.profileWriting || context.profileRevision !== live.profileRevision)
    throw new Error('Profile changed during review. Start a fresh deep review.');
  const card = context.board.get<Card>('card', review(context, live.id).cardId);
  if (assertConfirmedContext(card).revision !== live.contextRevision)
    throw new Error('Application context changed during review. Confirm and run again.');
  if (packetDigest(card) !== live.expectedPacketDigest)
    throw new Error('Packet changed during deep review. Start a fresh review.');
  return card;
};
export const assertReviewEvidence = async (context: CrewContext, live: LiveDeepReview) => {
  const current = await readProfile(context.directory);
  assertReviewCurrent(context, live);
  if (profileDigest(current) !== live.profileDigest)
    throw new Error('Profile evidence changed during review. Start a fresh deep review.');
};

export const failReviewContinuation = (context: CrewContext, id: string, error: string) => {
  const report = review(context, id);
  if (report.status !== 'waiting') return;
  updateReview(
    context,
    id,
    {
      status: 'failed',
      summary: `Review continuation could not start: ${error}`,
      error,
      finishedAt: new Date().toISOString(),
    },
    'Deep-review continuation failed',
  );
  for (const run of context.board
    .list<Run>('run')
    .filter((run) => run.deepReviewId === id && run.status === 'waiting')) {
    context.board.record(
      'run',
      { ...run, status: 'failed', message: error, finishedAt: new Date().toISOString() },
      run.roleId,
      'Deep-review continuation failed',
    );
    if (run.requestId) {
      const request = context.board.get<import('@pitchcrew/core').ChatRequest>(
        'chat_request',
        run.requestId,
      );
      context.board.record(
        'chat_request',
        {
          ...request,
          deliveries: request.deliveries.map((delivery) =>
            delivery.roleId === run.roleId && delivery.status === 'waiting'
              ? { ...delivery, status: 'failed' as const, error }
              : delivery,
          ),
        },
        'system',
        'Deep-review continuation failed',
      );
    }
  }
};
