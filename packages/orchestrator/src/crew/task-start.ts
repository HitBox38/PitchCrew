import type { AgentTask, Run } from '@pitchcrew/core';
import { refreshRound } from './delegation-rounds.ts';
import type { CrewContext } from './types.ts';

/**
 * Marks a queued crew task running with its run, right after the run is saved and before the turn
 * can start. A fast turn settles its task when it ends; marking it here means that settlement
 * always comes after this write, never before it.
 */
export const startTaskRun = (context: CrewContext, run: Run): void => {
  if (!run.taskId) return;
  const task = context.board.get<AgentTask>('task', run.taskId);
  if (task.status !== 'queued') return;
  context.board.record(
    'task',
    { ...task, status: 'running', runId: run.id },
    'orchestrator',
    `Started queued ${task.roleId} ${task.mode}`,
  );
  if (task.roundId) refreshRound(context, task.roundId);
};
