import {
  decodeEvent,
  pipelineFollowupInput,
  pipelineReviewInput,
  type PipelineReview,
  type Role,
  type RoleId,
  type Run,
} from '@pitchcrew/core';
import { eventSummary, pipelineEvidenceKinds } from './query.ts';
import { randomUUID } from 'node:crypto';
import type { CrewContext, RunCapability } from '../types.ts';

function validateEvidence(
  context: CrewContext,
  ids: number[],
  scope: PipelineReview['scope'],
  targetRoleId?: string,
) {
  const evidence: PipelineReview['evidence'] = [];
  for (const id of ids) {
    const row = context.board.db.prepare('SELECT json FROM events WHERE id = ?').get(id) as
      | { json: string }
      | undefined;
    if (!row) throw new Error(`Evidence event ${id} does not exist.`);
    const event = decodeEvent(row.json);
    if (!pipelineEvidenceKinds.includes(event.kind))
      throw new Error('Use board application, run, role, skill or review evidence.');
    if ((scope.from && event.createdAt < scope.from) || (scope.to && event.createdAt > scope.to))
      throw new Error('Evidence is outside the review dates.');
    if (
      scope.cardIds.length &&
      !['role', 'proposal', 'skill', 'skill_proposal'].includes(event.kind)
    ) {
      const data = event.data as unknown as {
        id: string;
        cardId?: string | null;
        candidateIds?: string[];
        scope?: { cardIds: string[] };
      };
      const cardIds = event.kind === 'card' ? [data.id] : data.cardId ? [data.cardId] : [];
      if (String(event.kind) === 'tracking_signal') cardIds.push(...(data.candidateIds ?? []));
      if (event.kind === 'pipeline_review') cardIds.push(...(data.scope?.cardIds ?? []));
      if (!cardIds.some((id) => scope.cardIds.includes(id)))
        throw new Error('Evidence is outside the review applications.');
    }
    evidence.push({
      eventId: id,
      kind: event.kind,
      entityId: event.entityId,
      actor: event.actor,
      createdAt: event.createdAt,
      message: event.message.slice(0, 500),
      summary: JSON.stringify(eventSummary({ ...event, id })).slice(0, 2000),
    });
    if (targetRoleId && event.kind === 'role' && event.entityId !== targetRoleId)
      throw new Error('Role evidence must describe the assessed role.');
  }
  return evidence;
}
export function savePipelineReview(
  context: CrewContext,
  capability: RunCapability,
  input: unknown,
) {
  const parsed = pipelineReviewInput.parse(input);
  if (
    context.board
      .list<PipelineReview>('pipeline_review')
      .filter((r) => r.runId === capability.runId).length >= 3
  )
    throw new Error('Three batch reviews maximum per run.');
  const activeRoles = context.board
    .list<Role>('role')
    .filter((role) => !('retiredAt' in role && role.retiredAt));
  if (
    new Set(parsed.seats.map((seat) => seat.roleId)).size !== parsed.seats.length ||
    activeRoles.some((role) => !parsed.seats.some((seat) => seat.roleId === role.id)) ||
    parsed.seats.some((seat) => !activeRoles.some((role) => role.id === seat.roleId))
  )
    throw new Error(
      'Assess every current crew seat once, or explicitly mark insufficient evidence.',
    );
  for (const id of parsed.scope.cardIds) context.board.get('card', id);
  for (const finding of parsed.findings) {
    context.board.get<Role>('role', finding.targetRoleId);
    if (!parsed.criteria.includes(finding.criterion))
      throw new Error('Each finding must use a declared evaluation criterion.');
    validateEvidence(context, finding.evidenceEventIds, parsed.scope, finding.targetRoleId);
  }
  const ids = [...new Set(parsed.findings.flatMap((f) => f.evidenceEventIds))];
  if (ids.length > 60) throw new Error('Sixty distinct evidence events maximum per review.');
  const evidence = validateEvidence(context, ids, parsed.scope);
  const run = context.board.get<Run>('run', capability.runId);
  const now = new Date().toISOString();
  const noticeMessageId = randomUUID();
  const review: PipelineReview = {
    ...parsed,
    id: randomUUID(),
    roleId: capability.roleId,
    runId: capability.runId,
    threadId: run.threadId ?? 'crew',
    evidence,
    followups: [],
    noticeMessageId,
    createdAt: now,
    updatedAt: now,
  };
  // Validate the complete stored payload before announcing it to stream subscribers.
  if (Buffer.byteLength(JSON.stringify(review), 'utf8') > 512000)
    throw new Error('Pipeline review exceeds the 512 KB limit. Narrow its findings and evidence.');
  return context.board.db.transaction(() => {
    context.addMessage(
      run.threadId ?? 'crew',
      capability.roleId,
      'user',
      `Pipeline review ready: ${parsed.title}. Review its evidence and recommendations in Crew work. Changes require your explicit approval.`,
      capability.cardId,
      capability.runId,
      noticeMessageId,
      'attention',
    );
    context.board.record(
      'pipeline_review',
      review,
      capability.roleId,
      `Saved pipeline review: ${review.title}`,
    );
    return { review };
  })();
}
export function updatePipelineReview(context: CrewContext, input: unknown, actor: RoleId | 'user') {
  const { reviewId, ...followup } = pipelineFollowupInput.parse(input);
  const current = context.board.get<PipelineReview>('pipeline_review', reviewId);
  if (!current.findings.some((finding) => finding.id === followup.findingId))
    throw new Error('Finding not found.');
  // Follow-up evidence may occur after the original review window, but must cover its applications.
  const additional = validateEvidence(context, followup.evidenceEventIds, {
    cardIds: current.scope.cardIds,
  });
  const evidence = [
    ...current.evidence.filter((e) => !additional.some((a) => a.eventId === e.eventId)),
    ...additional,
  ];
  if (evidence.length > 120)
    throw new Error('One hundred twenty evidence events maximum including follow-ups.');
  const review: PipelineReview = {
    ...current,
    evidence,
    followups: [...current.followups.filter((f) => f.findingId !== followup.findingId), followup],
    updatedAt: new Date().toISOString(),
  };
  if (Buffer.byteLength(JSON.stringify(review), 'utf8') > 512000)
    throw new Error('Review follow-up exceeds the 512 KB limit. Narrow its evidence.');
  context.board.record(
    'pipeline_review',
    review,
    actor,
    `Updated pipeline finding follow-up: ${followup.findingId}`,
  );
  return { review };
}
