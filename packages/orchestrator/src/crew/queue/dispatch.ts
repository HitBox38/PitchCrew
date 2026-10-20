import type { AgentTask, Conversation, Role, Run, WorkQueue } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import { requestProblem } from './requests.ts';
import { activeQueues, queueRequests, queueWaiting, taskLane } from './state.ts';

/** Keep an admitted action together; otherwise serve the oldest ready queue. */
export async function queueMayStart(
  context: CrewContext,
  id: string,
  root: string,
): Promise<boolean> {
  const active = activeQueues(context);
  if (active.get(id)?.has(root)) return true;
  const runs = context.board.list<Run>('run');
  const roles = context.board.list<Role>('role');
  const tasks = context.board.list<AgentTask>('task');
  for (const queue of context.board
    .list<WorkQueue>('work_queue')
    .sort((a, b) => a.order - b.order)) {
    if (
      active.has(queue.id) ||
      queue.paused ||
      queueWaiting(context, queue.id) ||
      queue.id.startsWith('routine:')
    )
      continue;
    const head = queueRequests(context, queue.id)[0];
    const readyRequest =
      head?.deliveries.some((d) => d.status === 'queued') && !(await requestProblem(context, head));
    const readyFollowUp = tasks.some((task) => {
      const role = roles.find((r) => r.id === task.roleId);
      if (!role || !context.taskPermissionsAllow(task)) return false;
      const thread = context.board
        .list<Conversation>('conversation')
        .find((c) => c.id === task.threadId);
      const config =
        task.mode === 'workflow' ? role : { ...role, ...thread?.configurations[task.roleId] };
      return (
        task.status === 'queued' &&
        taskLane(context, task) === queue.id &&
        runs.find((r) => r.id === task.parentRunId)?.status === 'completed' &&
        role.enabled &&
        !role.retiredAt &&
        !context.configuring.has(role.id) &&
        !context.runtimeMaintenance.held(config) &&
        context.runtimes.some((r) => r.id === config?.runtime && r.available)
      );
    });
    if (readyRequest || readyFollowUp) return queue.id === id;
  }
  return true;
}
