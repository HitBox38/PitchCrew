import {
  roleChanges,
  type PipelineReview,
  type Role,
  type RoleProposal,
  type Run,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { CrewContext, RunCapability } from '../types.ts';
import { configRevision } from './snapshots.ts';

export const crewChangesInput = z.object({
  targetRoleId: z.string().min(1).max(64),
  targetRevision: z.string().regex(/^[a-f0-9]{64}$/),
  pipelineReviewId: z.uuid(),
  findingId: z.string().min(1).max(40),
  reason: z.string().trim().min(1).max(2000),
  changes: roleChanges,
});
export function proposeCrewChanges(
  context: CrewContext,
  capability: RunCapability,
  input: unknown,
) {
  const parsed = crewChangesInput.parse(input);
  const review = context.board.get<PipelineReview>('pipeline_review', parsed.pipelineReviewId);
  if (review.roleId !== capability.roleId)
    throw new Error('Create your own attributed review before proposing crew changes.');
  const finding = review.findings.find((f) => f.id === parsed.findingId);
  if (!finding || finding.targetRoleId !== parsed.targetRoleId)
    throw new Error('Choose a finding for this target role.');
  const target = context.board.get<Role>('role', parsed.targetRoleId);
  if (!target.enabled || ('retiredAt' in target && target.retiredAt))
    throw new Error('Choose an enabled, active target role.');
  if (configRevision(target) !== parsed.targetRevision)
    throw new Error(
      'Target role settings changed. Read the current role and create a new proposal.',
    );
  if (
    context.board.list<RoleProposal>('proposal').filter((p) => p.runId === capability.runId)
      .length >= 3
  )
    throw new Error('Three role proposals maximum per run.');
  const run = context.board.get<Run>('run', capability.runId);
  return context.board.db.transaction(() => {
    const notice = context.addMessage(
      run.threadId ?? 'crew',
      capability.roleId,
      'user',
      `I propose changes to ${target.name}: ${parsed.reason}
Review the exact before/after settings in Crew work. Your decision is required before adoption.`,
      capability.cardId,
      capability.runId,
      randomUUID(),
      'attention',
    );
    const proposal: RoleProposal = {
      id: randomUUID(),
      roleId: target.id,
      sourceRoleId: capability.roleId,
      runId: capability.runId,
      reason: parsed.reason,
      changes: parsed.changes,
      beforeRole: structuredClone(target),
      targetRevision: parsed.targetRevision,
      pipelineReviewId: review.id,
      findingId: finding.id,
      noticeMessageId: notice.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    context.board.record(
      'proposal',
      proposal,
      capability.roleId,
      `${capability.roleId} proposed reviewed changes to ${target.name}`,
    );
    return { proposal };
  })();
}
