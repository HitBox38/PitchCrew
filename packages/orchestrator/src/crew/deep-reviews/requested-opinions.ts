import { randomUUID } from 'node:crypto';
import type { ReviewSubagent, Run } from '@pitchcrew/core';
import type { ReviewPerspective } from '@pitchcrew/core/deep-review-labels';
import type { CrewContext } from '../types.ts';
import type { LiveDeepReview } from './types.ts';
import { review, assertReviewCurrent } from './state.ts';
import { reviewChildren, reviewAgentAction } from './subagents.ts';
import { runConfiguration } from '../pipeline/snapshots.ts';

function unperformed(
  context: CrewContext,
  live: LiveDeepReview,
  perspective: ReviewPerspective,
  reason: string,
) {
  const report = review(context, live.id);
  const now = new Date().toISOString();
  const run: Run = {
    id: randomUUID(),
    roleId: live.reviewer.id,
    runtime: live.reviewer.runtime,
    cardId: report.cardId,
    deepReviewId: live.id,
    rootRunId: context.board.get<Run>('run', live.runId).rootRunId ?? live.runId,
    mode: 'workflow',
    threadId: report.threadId,
    status: 'failed',
    message: reason,
    startedAt: now,
    finishedAt: now,
  };
  const child: ReviewSubagent = {
    id: randomUUID(),
    reviewId: live.id,
    runId: run.id,
    stage: 'review',
    inputPacketDigest: live.expectedPacketDigest,
    perspective,
    focus: 'User-requested targeted second opinion.',
    reason: 'Explicitly requested by the user.',
    runtime: live.reviewer.runtime,
    model: live.reviewer.model,
    status: 'failed',
    error: reason,
    createdAt: now,
    finishedAt: now,
  };
  context.board.record(
    'run',
    { ...run, reviewSubagentId: child.id },
    live.reviewer.id,
    'Recorded unperformed user-requested opinion',
  );
  context.board.record(
    'review_subagent',
    child,
    live.reviewer.id,
    'User-requested second opinion incomplete',
  );
}
/** Known user-selected work, scheduled by the app; the runtime still owns every model/tool loop. */
export async function prepareRequestedOpinions(context: CrewContext, live: LiveDeepReview) {
  const report = review(context, live.id);
  if (!report.options.secondOpinions) return;
  const perspectives: ReviewPerspective[] = report.options.requestedPerspectives.length
    ? report.options.requestedPerspectives
    : ['relevance', 'impact'];
  const now = new Date().toISOString();
  const run: Run = {
    id: randomUUID(),
    cardId: report.cardId,
    roleId: live.reviewer.id,
    runtime: live.reviewer.runtime,
    deepReviewId: live.id,
    reviewStage: 'review',
    rootRunId: context.board.get<Run>('run', live.runId).rootRunId ?? live.runId,
    configuration: runConfiguration(live.reviewer, live.skills.get(live.reviewer.id) ?? []),
    purpose: 'application-review',
    threadId: report.threadId,
    mode: 'workflow',
    status: 'running',
    message: 'Scheduling user-requested second opinions',
    startedAt: now,
    finishedAt: null,
  };
  const token = randomUUID();
  const capability = { runId: run.id, roleId: run.roleId, cardId: run.cardId };
  context.board.record('run', run, run.roleId, run.message);
  context.capabilities.set(token, capability);
  context.controllers.set(run.id, live.controller);
  live.stage = 'review';
  live.coordinatingRequested = true;
  try {
    for (const perspective of perspectives) {
      assertReviewCurrent(context, live);
      try {
        let result: Record<string, unknown>;
        do {
          result = await reviewAgentAction(context, capability, 'start_review_subagent', {
            perspective,
            focus: `Give an independent ${perspective} assessment of this resume against the confirmed job and verified evidence.`,
            reason: 'The user explicitly requested this targeted second opinion.',
          });
          if (result.status === 'busy')
            await Promise.race([...live.children.values()].map((child) => child.done));
          assertReviewCurrent(context, live);
        } while (result.status === 'busy');
      } catch (error) {
        if (live.controller.signal.aborted) throw error;
        unperformed(
          context,
          live,
          perspective,
          error instanceof Error ? error.message : 'Requested opinion could not run.',
        );
      }
    }
    await Promise.allSettled([...live.children.values()].map((child) => child.done));
    assertReviewCurrent(context, live);
  } finally {
    live.coordinatingRequested = false;
    context.capabilities.delete(token);
    context.controllers.delete(run.id);
    context.board.record(
      'run',
      {
        ...run,
        status: live.controller.signal.aborted ? 'cancelled' : 'completed',
        message: 'User-requested second opinion scheduling finished',
        finishedAt: new Date().toISOString(),
      },
      run.roleId,
      'Finished requested second opinions',
    );
    context.publishChat(true);
  }
}
/** Never present omitted user-requested work as completed independent review. */
export function recordMissingRequestedOpinions(context: CrewContext, live: LiveDeepReview) {
  const report = review(context, live.id);
  if (!report.options.secondOpinions) return;
  const children = reviewChildren(context, live.id).filter((child) => child.stage === 'review');
  for (const perspective of report.options.requestedPerspectives)
    if (!children.some((child) => child.perspective === perspective))
      unperformed(
        context,
        live,
        perspective,
        'The requested additional opinion was not performed. Available parent findings remain usable; this is an incomplete optional opinion.',
      );
}
