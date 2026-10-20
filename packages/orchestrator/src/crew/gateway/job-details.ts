import { updateJobDetails } from '@pitchcrew/board';
import { updateJobInput, type Run } from '@pitchcrew/core';
import type { CrewContext, RunCapability } from '../types.ts';

export function correctJobDetails(
  context: CrewContext,
  capability: RunCapability,
  data: unknown,
): Record<string, unknown> {
  const run = context.board.get<Run>('run', capability.runId);
  if (context.closing || run.status !== 'running' || run.mode !== 'chat' || run.purpose)
    throw new Error('Job corrections require an active ordinary chat turn.');
  const input = updateJobInput.parse(data);
  if (capability.cardId && input.cardId && input.cardId !== capability.cardId)
    throw new Error('Job corrections are scoped to the attached job.');
  const cardId = input.cardId ?? capability.cardId;
  if (!cardId) throw new Error('Choose a job ID or attach a job before correcting its details.');
  return {
    card: updateJobDetails(
      context.board,
      cardId,
      input.changes,
      capability.roleId,
      capability.runId,
      input.reason,
    ),
  };
}
