import { sourceArguments } from '../../process.ts';
import { guideForRun } from '../../quality/writing.ts';
import { selectedChatSkills } from '../chat-references.ts';
import { reviewChildren } from './subagents.ts';
import { reviewClarifications } from './clarifications.ts';
import { subagentCard } from './inputs.ts';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { adapters } from '@pitchcrew/adapters';
import {
  draftingCard,
  runResultSchema,
  type DeepReview,
  type ReviewFinding,
  type ReviewSubagent,
  type Role,
  type Run,
} from '@pitchcrew/core';
import { runConfiguration } from '../pipeline/snapshots.ts';
import { endQuestionTurn } from '../user-input/lifecycle.ts';
import { applicationUserAnswers } from '../application-context/answers.ts';
import { assertApplicationRuntime } from '../application-context/extraction.ts';
import { beginAiRun } from '../../telemetry/ai.ts';
import { recordChatActivity, finishChatActivity } from '../chat-activity.ts';
import type { CrewContext } from '../types.ts';
import { assertReviewCurrent, assertReviewEvidence, review } from './state.ts';
import { ReviewWaiting, type LiveDeepReview } from './types.ts';

const executeReviewStagePrepared = async (
  context: CrewContext,
  live: LiveDeepReview,
  role: Role,
  stage: DeepReview['stage'],
  findings?: ReviewFinding[],
  child?: ReviewSubagent,
  childSignal?: AbortSignal,
  budgetRequest?: { minutes: number; reason: string },
) => {
  assertApplicationRuntime(role);
  if (!context.runtimes.some((r) => r.id === role.runtime && r.available))
    throw new Error('The selected review runtime is unavailable.');
  const rootRun = context.board.get<Run>('run', live.runId);
  const selectedSkills = rootRun.requestId
    ? selectedChatSkills(
        context,
        context.board.get<import('@pitchcrew/core').ChatRequest>('chat_request', rootRun.requestId)
          .references,
        role.id,
      )
    : [];
  const report = review(context, live.id);
  const card = assertReviewCurrent(context, live);
  const controller = new AbortController();
  const abort = () => controller.abort();
  live.controller.signal.addEventListener('abort', abort, { once: true });
  childSignal?.addEventListener('abort', abort, { once: true });
  if (childSignal?.aborted) controller.abort();
  const run: Run = {
    writingGuide: guideForRun(context),
    id: child?.runId ?? randomUUID(),
    roleId: role.id,
    runtime: role.runtime,
    cardId: card.id,
    deepReviewId: live.id,
    reviewBudgetRequest: !!budgetRequest,
    reviewSubagentId: child?.id,
    reviewStage: stage,
    rootRunId: context.board.get<Run>('run', live.runId).rootRunId ?? live.runId,
    purpose: role.workflow === 'writer' ? 'application-draft' : 'application-review',
    contextRevision: live.contextRevision,
    threadId: report.threadId,
    mode: 'workflow',
    status: 'running',
    message: budgetRequest
      ? 'Parent Reviewer deciding additional time'
      : child
        ? `Second opinion: ${child.perspective}`
        : `Deep review: ${stage}`,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    inputPacketDigest: live.expectedPacketDigest,
    configuration: runConfiguration(role, live.skills.get(role.id) ?? context.skills(role.id)),
  };
  const token = randomUUID();
  const directory = join(context.directory, 'roles', role.id, 'runs', run.id);
  context.controllers.set(run.id, controller);
  context.capabilities.set(token, { runId: run.id, cardId: card.id, roleId: role.id });
  context.board.record('run', run, role.id, run.message);
  const ai = beginAiRun(context.diagnostics, 'workflow');
  try {
    await context.writeRunInstructions(directory, role, run.configuration!.skills);
    const currentCard = assertReviewCurrent(context, live);
    const result = await ai.observe(
      () =>
        adapters[role.runtime].run({
          card: child
            ? subagentCard(draftingCard(currentCard, run.purpose))
            : draftingCard(currentCard, run.purpose),
          purpose: run.purpose,
          role,
          skills: run.configuration!.skills,
          selectedSkills,
          profile: live.profile,
          userAnswers: applicationUserAnswers(context, card.id, role.id, run.purpose),
          packetRules: context.packetRules.current().rules,
          directory,
          deepReview: {
            id: live.id,
            stage,
            findings,
            clarifications: reviewClarifications(context, live.id),
            budgetRequest,
            subagent: child ? { perspective: child.perspective, focus: child.focus } : undefined,
            secondOpinionResults:
              child || role.workflow === 'writer' || budgetRequest
                ? []
                : reviewChildren(context, live.id)
                    .filter((item) => item.stage === stage)
                    .map((item) => ({
                      perspective: item.perspective,
                      status: item.status,
                      summary: item.assessment?.summary,
                      findings: item.assessment?.findings.slice(0, 5) ?? [],
                      error: item.error,
                    })),
            secondOpinions: !child && stage === 'review' ? report.options.secondOpinions : false,
            requestedPerspectives:
              !child && stage === 'review' ? report.options.requestedPerspectives : [],
            maxConcurrentSubagents: child
              ? 0
              : (adapters[role.runtime].reviewSubagents?.maxConcurrent ?? 0),
            alternatives: child ? [] : report.options.alternatives,
          },
          deadline: live.deadline,
          writingGuide: run.writingGuide,
          mcp: {
            command: process.execPath,
            args: sourceArguments(context.mcpEntry),
            env: { PITCHCREW_RUN_TOKEN: token, PITCHCREW_DAEMON_URL: context.daemonUrl },
          },
          signal: controller.signal,
          onMessage: (message) => {
            const current = context.board.get<Run>('run', run.id);
            if (current.status === 'running')
              context.board.record('run', { ...current, message }, role.id, message);
            context.publishChat();
          },
          onActivity: (activity) => recordChatActivity(context, run.id, activity),
        }),
      controller.signal,
    );
    if (endQuestionTurn(context, run)) {
      if (context.board.get<Run>('run', run.id).status === 'cancelled') {
        live.controller.abort();
        throw new Error('Review question cancelled.');
      }
      throw new ReviewWaiting('Waiting for your answer');
    }
    if (controller.signal.aborted) throw new Error('Review stage cancelled.');
    await assertReviewEvidence(context, live);
    const parsed = runResultSchema.parse(result);
    if (parsed.role !== (role.workflow === 'writer' ? 'writer' : 'reviewer'))
      throw new Error('Review stage returned the wrong workflow result.');
    context.board.record(
      'run',
      {
        ...run,
        status: 'completed',
        message: 'Review stage completed',
        finishedAt: new Date().toISOString(),
      },
      role.id,
      'Completed deep-review stage',
    );
    return { result: parsed, runId: run.id };
  } catch (error) {
    if (endQuestionTurn(context, run)) {
      if (context.board.get<Run>('run', run.id).status === 'cancelled') {
        live.controller.abort();
        throw new Error('Review question cancelled.');
      }
      throw new ReviewWaiting('Waiting for your answer');
    }
    ai.fail(error);
    context.board.record(
      'run',
      {
        ...run,
        status: controller.signal.aborted ? 'cancelled' : 'failed',
        message: error instanceof Error ? error.message : 'Review stage failed.',
        finishedAt: new Date().toISOString(),
      },
      role.id,
      'Deep-review stage ended',
    );
    throw error;
  } finally {
    const outcome = context.board.get<Run>('run', run.id).status;
    ai.finish(outcome === 'running' ? 'failed' : outcome);
    finishChatActivity(context, run.id);
    live.controller.signal.removeEventListener('abort', abort);
    childSignal?.removeEventListener('abort', abort);
    context.controllers.delete(run.id);
    context.capabilities.delete(token);
    context.publishChat(true);
  }
};

export const executeReviewStage = (...args: Parameters<typeof executeReviewStagePrepared>) => {
  return args[0].runtimeMaintenance.guard(args[2], () => executeReviewStagePrepared(...args));
};
