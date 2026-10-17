import { recordMissingRequestedOpinions, prepareRequestedOpinions } from './requested-opinions.ts';
import { digestPacket } from '@pitchcrew/board';
import type { Card, ReviewAssessment } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import { assertReviewCurrent, assertReviewEvidence, review, updateReview } from './state.ts';
import { executeReviewStage } from './stages.ts';
import { assessmentFor } from './assessment.ts';
import type { LiveDeepReview } from './types.ts';

async function settleChildren(live: LiveDeepReview) {
  const children = [...live.children.values()];
  for (const child of children) child.controller.abort();
  await Promise.allSettled(children.map((child) => child.done));
}
export async function reviewFlow(context: CrewContext, live: LiveDeepReview) {
  const report = review(context, live.id);
  if (!live.packet || live.stage === 'draft') await writeStage(context, live, 'draft');
  let initial = report.before;
  const resumeAtRecheck = live.stage === 'recheck' && !!initial;
  if (!initial || !['correction', 'recheck'].includes(live.stage)) {
    await prepareRequestedOpinions(context, live);
    const { assessment: before } = await assessStage(context, live, 'review');
    recordMissingRequestedOpinions(context, live);
    updateReview(
      context,
      live.id,
      {
        before,
        originalResume: report.originalResume ?? live.packet!.resume,
        inputPacketDigest: report.inputPacketDigest ?? live.expectedPacketDigest ?? undefined,
        beforeProfileDigest: live.profileDigest,
        beforeContextRevision: live.contextRevision,
      },
      'Initial hiring perspectives completed',
    );
    initial = before;
  }
  if (
    !resumeAtRecheck &&
    (live.stage === 'correction' ||
      initial.findings.length ||
      (live.packet && (await context.packetRules.check(live.packet, live.profile)).errors.length))
  )
    await writeStage(context, live, 'correction', initial);
  const { assessment: after, feedback: recheckFeedback } = await assessStage(
    context,
    live,
    'recheck',
  );
  await assertReviewEvidence(context, live);
  const card = assertReviewCurrent(context, live);
  const blockers = after.findings
    .filter((f) => f.severity === 'blocking')
    .map((f) => `${f.quote}: ${f.reason} ${f.correction}`.slice(0, 2000));
  const feedback = [...new Set([...blockers, ...recheckFeedback])];
  await context.applyResult(
    card.id,
    live.reviewer,
    {
      role: 'reviewer',
      passed: feedback.length === 0,
      feedback: feedback.slice(0, 30),
      suggestions: after.findings
        .filter((f) => f.severity === 'advisory')
        .map((f) => `${f.quote}: ${f.reason}`.slice(0, 2000)),
    },
    live.profile,
    live.controller.signal,
    { contextRevision: live.contextRevision, runId: live.runId },
  );
  await assertReviewEvidence(context, live);
  const finalCard = context.board.get<Card>('card', card.id);
  const passed = finalCard.state === 'agreed';
  after.packetFeedback = [
    ...new Set(finalCard.feedback.filter((note) => !note.startsWith('Warning: '))),
  ].slice(0, 30);
  after.suggestions = [
    ...new Set([
      ...(after.suggestions ?? []),
      ...finalCard.feedback
        .filter((note) => note.startsWith('Warning: '))
        .map((note) => note.slice(9)),
    ]),
  ].slice(0, 60);
  const incomplete = context.board
    .list<import('@pitchcrew/core').ReviewSubagent>('review_subagent')
    .filter((child) => child.reviewId === live.id && child.status !== 'completed').length;
  updateReview(
    context,
    live.id,
    {
      after,
      finalResume: finalCard.packet!.resume,
      finalPacketDigest: digestPacket(card.id, finalCard.packet!),
      status: passed ? 'completed' : 'needs_changes',
      finishedAt: new Date().toISOString(),
      summary: `${passed ? 'Resume review and packet recheck completed.' : 'Review completed with changes still needed.'}${incomplete ? ` ${incomplete} optional second opinion(s) were incomplete.` : ''}`,
    },
    passed ? 'Deep review completed' : 'Deep review needs further changes',
  );
}
async function assessStage(
  context: CrewContext,
  live: LiveDeepReview,
  stage: 'review' | 'recheck',
) {
  live.stage = stage;
  const card = assertReviewCurrent(context, live);
  if (card.state !== 'in_review')
    context.board.record(
      'card',
      {
        ...card,
        state: 'in_review',
        owner: live.reviewer.id,
        packetReview: undefined,
        updatedAt: new Date().toISOString(),
      },
      live.reviewer.id,
      'Started deep packet assessment',
    );
  context.board.updateCard(
    card.id,
    { owner: live.reviewer.id },
    live.reviewer.id,
    'Reviewer is assessing the deep-review packet',
  );
  updateReview(
    context,
    live.id,
    { stage },
    stage === 'review' ? 'Reviewing seven hiring perspectives' : 'Rechecking corrected packet',
  );
  const { result } = await executeReviewStage(context, live, live.reviewer, stage);
  await settleChildren(live);
  const additional = context.board
    .list<import('@pitchcrew/core').ReviewSubagent>('review_subagent')
    .filter(
      (child) =>
        child.reviewId === live.id && child.stage === stage && child.status === 'completed',
    )
    .map((child) => child.perspective);
  const assessment = assessmentFor(result, live.packet!.resume, undefined, additional);
  if (result.role === 'reviewer') {
    const feedback = result.feedback.length
      ? result.feedback
      : !result.passed
        ? ['Reviewer did not pass this packet. Resolve its review findings before approval.']
        : [];
    if (
      stage !== 'recheck' &&
      feedback.length &&
      !assessment.findings.some((f) => f.severity === 'blocking')
    )
      assessment.findings.unshift({
        severity: 'blocking',
        quote: '[MISSING: passing packet review]',
        reason: feedback.join('\n').slice(0, 2000),
        correction: 'Resolve the packet blockers using verified evidence.',
        perspectives: ['screen'],
      });
  }
  return {
    assessment,
    feedback:
      result.role === 'reviewer'
        ? result.feedback.length
          ? result.feedback
          : !result.passed
            ? ['Reviewer did not pass this packet. Resolve its review findings before approval.']
            : []
        : [],
  };
}
async function writeStage(
  context: CrewContext,
  live: LiveDeepReview,
  stage: 'draft' | 'correction',
  assessment?: ReviewAssessment,
) {
  live.stage = stage;
  const card = assertReviewCurrent(context, live);
  context.board.record(
    'card',
    {
      ...card,
      state: 'drafting',
      packetReview: undefined,
      owner: live.writer.id,
      updatedAt: new Date().toISOString(),
    },
    live.writer.id,
    stage === 'draft' ? 'Creating initial deep-review draft' : 'Correcting reviewed resume',
  );
  updateReview(
    context,
    live.id,
    { stage },
    stage === 'draft'
      ? 'Writer is creating the first tailored draft'
      : 'Writer is addressing review findings',
  );
  const { result, runId } = await executeReviewStage(
    context,
    live,
    live.writer,
    stage,
    assessment?.findings,
  );
  await context.applyResult(card.id, live.writer, result, live.profile, live.controller.signal, {
    contextRevision: live.contextRevision,
    runId,
  });
  const current = context.board.get<Card>('card', card.id);
  live.packet = current.packet;
  live.expectedPacketDigest = digestPacket(card.id, current.packet!);
  await assertReviewEvidence(context, live);
}
