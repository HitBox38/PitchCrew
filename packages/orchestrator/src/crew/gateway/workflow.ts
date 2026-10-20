import { changeJobState, deleteJob, searchApplications } from '@pitchcrew/board';
import {
  bulkDeleteJobsInput,
  bulkMoveJobsInput,
  states,
  type AgentCapabilities,
  type CardState,
} from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewContext, RunCapability } from '../types.ts';
import { oneLineChangeSummary } from '../change-summary.ts';

export const changeWorkflow = (
  context: CrewContext,
  capability: RunCapability,
  permissions: AgentCapabilities,
  action: string,
  data: Record<string, unknown>,
): Record<string, unknown> => {
  if (!permissions.manageWorkflow)
    throw new Error('Workflow capability is disabled for your role.');
  if (action === 'bulk_move_jobs' || action === 'bulk_delete_jobs') {
    const input = (action === 'bulk_move_jobs' ? bulkMoveJobsInput : bulkDeleteJobsInput).parse(
      data.input,
    );
    const state = 'state' in input ? z.enum(states).parse(input.state) : undefined;
    const results = input.cardIds.map((cardId) => {
      try {
        applyJobChange(context, capability, cardId, input.reason, state);
        return { cardId, ok: true, ...(state ? { state } : {}) };
      } catch (error) {
        return {
          cardId,
          ok: false,
          error: (error instanceof Error ? error.message : 'Job change failed.').slice(0, 500),
        };
      }
    });
    const succeeded = results.filter((result) => result.ok).length;
    return { results, succeeded, failed: results.length - succeeded };
  }
  if (action === 'jobs') {
    const { cards, nextOffset } = searchApplications(context.board, data.input ?? {});
    return {
      jobs: cards.map(({ id, company, title, state, location, url }) => ({
        id,
        company,
        title,
        state,
        location,
        url,
      })),
      nextOffset,
    };
  }
  const input = z
    .object({
      cardId: z.uuid().optional(),
      reason: z.string().trim().min(1).max(2000),
    })
    .parse(data);
  const cardId = input.cardId ?? capability.cardId;
  if (!cardId) throw new Error('Choose a job ID or attach a job before changing the board.');
  if (action === 'delete_job') {
    applyJobChange(context, capability, cardId, input.reason);
    return { ok: true, cardId };
  }
  const state = z.enum(states).parse(data.state);
  const card = applyJobChange(context, capability, cardId, input.reason, state);
  return { card };
};

const applyJobChange = (
  context: CrewContext,
  capability: RunCapability,
  cardId: string,
  reason: string,
  state?: CardState,
) => {
  return context.board.db.transaction(() => {
    const description = oneLineChangeSummary(
      `${state ? `Moved to ${state.replaceAll('_', ' ')}` : 'Deleted job'}: ${reason}`,
    );
    const card = state
      ? changeJobState(context.board, cardId, state, capability.roleId, description)
      : null;
    if (!state) deleteJob(context.board, cardId, capability.roleId, description);
    context.addMessage('crew', capability.roleId, 'crew', reason, cardId, capability.runId);
    return card;
  })();
};
