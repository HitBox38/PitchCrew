import { waitingOnUser } from '../user-input/lifecycle.ts';
import {
  defaultCapabilities,
  type Routine,
  type Role,
  type Run,
  type AgentTask,
} from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import { canReadConversation, conversation } from '../conversations.ts';
/** Ready scheduled work takes its chronological place beside user input and agent tasks. */
export function routineReadyBefore(context: CrewContext, roleId: string, order: number): boolean {
  const role = context.board.get<Role>('role', roleId);
  if (
    !role.enabled ||
    role.retiredAt ||
    !context.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available)
  )
    return false;
  return context.board.list<Routine>('routine').some((routine) => {
    if (
      routine.roleId !== roleId ||
      routine.deletedAt ||
      !routine.enabled ||
      !routine.nextRunAt ||
      Date.parse(routine.nextRunAt) > Date.now() ||
      Date.parse(routine.nextRunAt) >= order ||
      (routine.endsAt && Date.parse(routine.endsAt) < Date.now())
    )
      return false;
    if (
      routine.conversationId &&
      (waitingOnUser(context, routine.conversationId, roleId) ||
        !canReadConversation(context, roleId, routine.conversationId) ||
        conversation(context, routine.conversationId).cardId !== routine.cardId)
    )
      return false;
    if (routine.updatedBy !== 'user') {
      const source = context.board.get<Role>('role', routine.updatedBy);
      const permissions = { ...defaultCapabilities, ...source.capabilities };
      if (
        !source.enabled ||
        source.retiredAt ||
        !permissions.manageRoutines ||
        (source.id !== roleId && !permissions.invokeAgents)
      )
        return false;
    }
    if (
      routine.lastRunId &&
      (context.board
        .list<Run>('run')
        .some(
          (run) =>
            ['running', 'waiting'].includes(run.status) &&
            (run.id === routine.lastRunId || run.rootRunId === routine.lastRunId),
        ) ||
        context.board
          .list<AgentTask>('task')
          .some(
            (task) =>
              task.rootRunId === routine.lastRunId &&
              ['queued', 'running', 'waiting'].includes(task.status),
          ))
    )
      return false;
    return true;
  });
}
