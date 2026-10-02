import type { AgentCapabilities } from '@pitchcrew/core';
import { type Approval } from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewContext, RunCapability } from '../types.ts';

export async function changeWorkflow(
  this: CrewContext,
  capability: RunCapability,
  permissions: AgentCapabilities,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!permissions.manageWorkflow)
    throw new Error('Workflow capability is disabled for your role.');
  if (!capability.cardId) throw new Error('Attach a job before changing its workflow.');
  if (this.board.hasActiveRun(capability.cardId))
    throw new Error('Wait for the application’s active run to finish.');
  const input = z
    .object({
      state: z.enum(['shortlisted', 'changes_requested']),
      reason: z.string().trim().min(1).max(2000),
    })
    .parse(data);
  const card = this.board.move(capability.cardId, input.state, capability.roleId, input.reason);
  if (input.state === 'changes_requested')
    for (const approval of this.board
      .list<Approval>('approval')
      .filter((a) => a.cardId === card.id && ['pending', 'approved'].includes(a.status)))
      this.board.record(
        'approval',
        { ...approval, status: 'rejected', decidedAt: new Date().toISOString() },
        capability.roleId,
        'Invalidated approval after requesting changes',
      );
  this.addMessage('crew', capability.roleId, 'crew', input.reason, card.id, capability.runId);
  return { card };
}
