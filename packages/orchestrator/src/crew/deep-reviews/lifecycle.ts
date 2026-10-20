import type { Card, Run } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import { drainConversationQueue, finishDelivery } from '../conversation-queue.ts';
import { finishUserContinuation } from '../user-input/lifecycle.ts';
import { packetDigest } from '../pipeline/snapshots.ts';
import { reviewFlow } from './flow.ts';
import { ReviewWaiting, type LiveDeepReview } from './types.ts';
import { review, updateReview } from './state.ts';
import { reviewSummaryMessage } from './summary.ts';

export const executeDeepReview = async (context: CrewContext, live: LiveDeepReview, run: Run) => {
  const { id, controller, deadline, reviewer } = live;
  const { cardId, threadId } = review(context, id);
  let timer: ReturnType<typeof setTimeout>;
  const checkDeadline = () => {
    const remaining = deadline.expiresAt - Date.now();
    if (remaining <= 0)
      controller.abort(new Error('Pitchcrew stopped the deep review at its shared deadline.'));
    else timer = setTimeout(checkDeadline, Math.min(remaining, 2_147_483_647));
  };
  checkDeadline();
  context.publishChat(true);
  await reviewFlow(context, live)
    .catch((error) => {
      const waiting = error instanceof ReviewWaiting;
      const cancelled =
        controller.signal.aborted &&
        !(
          controller.signal.reason instanceof Error &&
          controller.signal.reason.message.includes('shared deadline')
        );
      const reason = waiting
        ? 'Waiting for your answer'
        : controller.signal.aborted && controller.signal.reason instanceof Error
          ? controller.signal.reason.message
          : error instanceof Error
            ? error.message
            : 'Deep review failed.';
      updateReview(
        context,
        id,
        {
          status: waiting ? 'waiting' : cancelled ? 'cancelled' : 'failed',
          error: waiting ? undefined : reason,
          summary: reason,
          currentPacketDigest: live.expectedPacketDigest,
          remainingMs: waiting ? Math.max(1000, deadline.expiresAt - Date.now()) : undefined,
          finishedAt: waiting ? null : new Date().toISOString(),
        },
        reason,
      );
    })
    .finally(async () => {
      clearTimeout(timer);
      for (const child of live.children.values()) child.controller.abort();
      await Promise.allSettled([...live.children.values()].map((child) => child.done));
      const current = review(context, id);
      const status: Run['status'] =
        current.status === 'waiting'
          ? 'waiting'
          : current.status === 'failed'
            ? 'failed'
            : current.status === 'cancelled'
              ? 'cancelled'
              : 'completed';
      const finished = {
        ...context.board.get<Run>('run', run.id),
        status,
        message: current.summary,
        outputPacketDigest: packetDigest(context.board.get<Card>('card', cardId)),
        finishedAt: new Date().toISOString(),
      };
      context.board.record('run', finished, reviewer.id, current.summary);
      const currentCard = context.board.get<Card>('card', cardId);
      if (
        ['drafting', 'in_review', 'agreed', 'awaiting_approval'].includes(currentCard.state) &&
        status !== 'completed'
      )
        context.board.record(
          'card',
          {
            ...currentCard,
            state: 'changes_requested',
            owner: null,
            packetReview: undefined,
            updatedAt: new Date().toISOString(),
          },
          reviewer.id,
          current.summary,
        );
      else
        context.board.updateCard(
          cardId,
          status === 'completed' ? { owner: null } : { owner: null, packetReview: undefined },
          reviewer.id,
          'Released deep-review application',
        );
      context.addMessage(
        threadId,
        reviewer.id,
        'user',
        reviewSummaryMessage(current),
        cardId,
        run.id,
      );
      if (current.sourceThreadId && current.sourceThreadId !== threadId)
        context.addMessage(
          current.sourceThreadId,
          reviewer.id,
          'user',
          reviewSummaryMessage(current),
          cardId,
          run.id,
        );
      for (const reservation of context.board
        .list<Run>('run')
        .filter((item) => item.deepReviewId === id && item.reviewSeatReservation)) {
        context.board.record(
          'run',
          { ...reservation, status, message: current.summary, finishedAt: finished.finishedAt },
          reservation.roleId,
          'Released deep-review workflow seat',
        );
        context.controllers.delete(reservation.id);
      }
      context.controllers.delete(run.id);
      context.deepReviewExecutions.delete(id);
      finishUserContinuation(context, finished);
      finishDelivery(context, finished);
      context.publishChat(true);
      void context.drainTasks();
      void drainConversationQueue(context);
    });
};
