import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { adapters } from '@pitchcrew/adapters';
import {
  defaultCapabilities,
  reviewSubagentInput,
  reviewTimeInput,
  type Run,
  type ReviewSubagent,
} from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewContext, RunCapability } from '../types.ts';
import { assessmentFor } from './assessment.ts';
import { assertReviewCurrent, review, updateReview } from './state.ts';
import { requireRole } from '../roles.ts';
import { executeReviewStage } from './stages.ts';

export const reviewChildren = (context: CrewContext, id: string) => {
  const rows = context.board.db
    .prepare(
      "SELECT json FROM entities WHERE kind='review_subagent' AND json_extract(json,'$.reviewId')=? ORDER BY rowid",
    )
    .all(id) as { json: string }[];
  return rows.map((row) => JSON.parse(row.json) as ReviewSubagent);
};
export const reviewAgentAction = async (
  context: CrewContext,
  capability: RunCapability,
  action: string,
  data: unknown,
) => {
  const run = context.board.get<Run>('run', capability.runId);
  if (!run.deepReviewId || run.status !== 'running')
    throw new Error('An active deep-review execution is required.');
  const live = context.deepReviewExecutions.get(run.deepReviewId);
  if (
    !live ||
    run.rootRunId !== (context.board.get<Run>('run', live.runId).rootRunId ?? live.runId)
  )
    throw new Error('This deep-review execution has ended.');
  const card = assertReviewCurrent(context, live);
  if (action === 'request_review_time') {
    const input = reviewTimeInput.parse(data);
    if (!run.reviewSubagentId && run.configuration?.role.workflow !== 'writer')
      throw new Error('The parent Reviewer extends the shared deadline directly.');
    if (run.reviewSubagentId) {
      const child = context.board.get<ReviewSubagent>('review_subagent', run.reviewSubagentId);
      context.board.record(
        'review_subagent',
        { ...child, timeRequest: { ...input, requestedAt: new Date().toISOString() } },
        run.roleId,
        'Requested more review time from the parent',
      );
    }
    updateReview(context, live.id, {}, `Additional time requested: ${input.reason}`);
    if (!run.reviewSubagentId || live.coordinatingRequested) {
      if (!live.budgetDecision)
        live.budgetDecision = executeReviewStage(
          context,
          live,
          live.reviewer,
          live.stage,
          undefined,
          undefined,
          undefined,
          input,
        ).finally(() => {
          live.budgetDecision = undefined;
        });
      await live.budgetDecision;
      return {
        requested: true,
        deadlineAt: new Date(live.deadline.expiresAt).toISOString(),
        remainingMs: Math.max(0, live.deadline.expiresAt - Date.now()),
        instruction:
          'The parent Reviewer has considered the time request. Continue within the shared deadline.',
      };
    }
    return {
      requested: true,
      deadlineAt: new Date(live.deadline.expiresAt).toISOString(),
      remainingMs: Math.max(0, live.deadline.expiresAt - Date.now()),
      instruction: 'The parent Reviewer owns this deadline; your request does not extend it.',
    };
  }
  if (run.reviewSubagentId || run.configuration?.role.workflow !== 'reviewer')
    throw new Error('Only the parent Reviewer may delegate or extend the review.');
  if (action === 'extend_review_deadline') {
    const input = reviewTimeInput.parse(data);
    live.deadline.expiresAt += input.minutes * 60_000;
    const report = review(context, live.id);
    updateReview(
      context,
      live.id,
      {
        deadlineAt: new Date(live.deadline.expiresAt).toISOString(),
        remainingMs: Math.max(0, live.deadline.expiresAt - Date.now()),
        extensions: [...report.extensions, { ...input, at: new Date().toISOString() }],
      },
      `Reviewer extended the deadline by ${input.minutes} minutes: ${input.reason}`,
    );
    return { deadlineAt: new Date(live.deadline.expiresAt).toISOString() };
  }
  if (action === 'review_subagents') {
    const input = z
      .object({
        offset: z.number().int().min(0).default(0),
        waitMs: z.number().int().min(0).max(10000).default(0),
      })
      .parse(data);
    if (input.waitMs && live.children.size)
      await Promise.race([
        Promise.allSettled([...live.children.values()].map((child) => child.done)),
        delay(input.waitMs, undefined, { signal: live.controller.signal }),
      ]);
    assertReviewCurrent(context, live);
    const children = reviewChildren(context, live.id);
    return {
      subagents: children.slice(input.offset, input.offset + 20),
      nextOffset: children.length > input.offset + 20 ? input.offset + 20 : null,
      deadlineAt: new Date(live.deadline.expiresAt).toISOString(),
      remainingMs: Math.max(0, live.deadline.expiresAt - Date.now()),
    };
  }
  if (run.reviewBudgetRequest) throw new Error('A deadline decision cannot start subagents.');
  if (action !== 'start_review_subagent') throw new Error('Unknown deep-review action.');
  if (!(requireRole(context, live.reviewer.id).capabilities ?? defaultCapabilities).invokeAgents)
    throw new Error('Agent invocation is disabled for Reviewer.');
  const input = reviewSubagentInput.parse(data);
  const report = review(context, live.id);
  const alternative =
    input.alternative === undefined ? undefined : report.options.alternatives[input.alternative];
  if (input.alternative !== undefined && !alternative)
    throw new Error('Choose an explicitly user-configured runtime alternative.');
  const role = alternative
    ? { ...live.reviewer, ...alternative, reasoning: alternative.reasoning ?? null }
    : live.reviewer;
  const support = adapters[role.runtime].reviewSubagents;
  if (
    !support ||
    !adapters[role.runtime].applicationIsolation ||
    !context.runtimes.some((r) => r.id === role.runtime && r.available)
  ) {
    const now = new Date().toISOString();
    const reason =
      'This runtime does not support available, isolated review subagents. Continue with the parent review.';
    const child: ReviewSubagent = {
      id: randomUUID(),
      reviewId: live.id,
      stage: live.stage,
      inputPacketDigest: live.expectedPacketDigest,
      runId: randomUUID(),
      perspective: input.perspective,
      focus: input.focus,
      reason: input.reason,
      runtime: role.runtime,
      model: role.model,
      status: 'unavailable',
      error: reason,
      createdAt: now,
      finishedAt: now,
    };
    context.board.record(
      'review_subagent',
      child,
      run.roleId,
      'Optional second opinion unavailable',
    );
    context.board.record(
      'run',
      {
        id: child.runId,
        cardId: card.id,
        roleId: role.id,
        runtime: role.runtime,
        status: 'failed',
        mode: 'workflow',
        deepReviewId: live.id,
        reviewSubagentId: child.id,
        rootRunId: run.rootRunId,
        threadId: report.threadId,
        message: reason,
        startedAt: now,
        finishedAt: now,
      },
      role.id,
      'Did not execute unavailable second opinion',
    );
    context.publishChat(true);
    return { status: 'unavailable', reason, subagent: child };
  }
  const running = reviewChildren(context, live.id).filter((child) => child.status === 'running');
  if (running.filter((child) => child.runtime === role.runtime).length >= support.maxConcurrent)
    return {
      status: 'busy',
      reason:
        'Runtime review-subagent capacity is in use. Inspect results before starting another.',
    };
  const child: ReviewSubagent = {
    id: randomUUID(),
    reviewId: live.id,
    stage: live.stage,
    inputPacketDigest: live.expectedPacketDigest,
    runId: randomUUID(),
    perspective: input.perspective,
    focus: input.focus,
    reason: input.reason,
    runtime: role.runtime,
    model: role.model,
    status: 'running',
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };
  context.board.record(
    'review_subagent',
    child,
    run.roleId,
    `Started targeted second opinion: ${input.perspective}`,
  );
  const controller = new AbortController();
  const resume = card.packet?.resume ?? '';
  const done = executeReviewStage(
    context,
    live,
    role,
    live.stage,
    undefined,
    child,
    controller.signal,
  )
    .then(({ result }) => {
      const assessment = assessmentFor(result, resume, child.perspective);
      const current = context.board.get<ReviewSubagent>('review_subagent', child.id);
      context.board.record(
        'review_subagent',
        { ...current, assessment, status: 'completed', finishedAt: new Date().toISOString() },
        role.id,
        'Completed targeted second opinion',
      );
    })
    .catch((error) => {
      const current = context.board.get<ReviewSubagent>('review_subagent', child.id);
      context.board.record(
        'review_subagent',
        {
          ...current,
          status:
            controller.signal.aborted || live.controller.signal.aborted ? 'cancelled' : 'failed',
          error: error instanceof Error ? error.message : 'Second opinion failed.',
          finishedAt: new Date().toISOString(),
        },
        role.id,
        'Second opinion incomplete',
      );
    })
    .finally(() => {
      live.children.delete(child.id);
      context.publishChat(true);
    });
  live.children.set(child.id, { controller, done });
  updateReview(
    context,
    live.id,
    {},
    `Review subagent started: ${input.perspective}. ${input.reason}`,
  );
  return {
    status: 'started',
    subagent: child,
    beyondDefault: reviewChildren(context, live.id).length > 2,
  };
};
