import {
  defaultCapabilities,
  type AgentTask,
  type Role,
  type RoleId,
  type Run,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import type { CrewContext } from './types.ts';

export function enqueue(
  this: CrewContext,
  capability: { runId: string; cardId: string | null; roleId: RoleId },
  roleId: RoleId,
  mode: AgentTask['mode'],
  content: string,
  trigger: AgentTask['trigger'],
): AgentTask {
  const parent = this.board.get<Run>('run', capability.runId);
  const rootRunId = parent.rootRunId ?? parent.id;
  const role = this.board.get<Role>('role', roleId);
  if (!role.enabled) throw new Error('The target role is paused.');
  if (!this.runtimes.find((r) => r.id === role.runtime)?.available)
    throw new Error('The target runtime is not available.');
  if (mode === 'workflow' && !capability.cardId)
    throw new Error('Attach a job before invoking a workflow.');
  if (this.board.list<AgentTask>('task').filter((t) => t.rootRunId === rootRunId).length >= 6)
    throw new Error(
      'This run chain reached its six follow-up limit. Ask the user to start another turn.',
    );
  const task: AgentTask = {
    id: randomUUID(),
    parentRunId: parent.id,
    rootRunId,
    roleId,
    cardId: capability.cardId,
    mode,
    trigger,
    threadId: 'crew',
    content,
    status: 'queued',
    runId: null,
    error: '',
    createdAt: new Date().toISOString(),
  };
  this.board.record(
    'task',
    task,
    capability.roleId,
    `${capability.roleId} queued ${roleId} ${mode}`,
  );
  this.addMessage('crew', capability.roleId, roleId, content, capability.cardId, parent.id);
  // Children start after their parent finishes, so a self-invocation never shares a session.
  return task;
}
export function finishTask(this: CrewContext, run: Run): void {
  const finished = this.board.get<Run>('run', run.id);
  if (run.taskId) {
    const task = this.board.get<AgentTask>('task', run.taskId);
    this.board.record(
      'task',
      {
        ...task,
        status:
          finished.status === 'completed'
            ? 'completed'
            : finished.status === 'cancelled'
              ? 'cancelled'
              : 'failed',
        error: finished.status === 'completed' ? '' : finished.message,
      },
      run.roleId,
      `${run.roleId} ${finished.status} a crew task`,
    );
  }
  if (run.mode === 'workflow')
    this.addMessage('crew', run.roleId, 'crew', finished.message, run.cardId, run.id);
}
export function taskPermissionsAllow(this: CrewContext, task: AgentTask): boolean {
  const parent = this.board.get<Run>('run', task.parentRunId);
  const source = this.board.get<Role>('role', parent.roleId);
  const permissions = source.capabilities ?? defaultCapabilities;
  return (
    source.enabled &&
    permissions[task.trigger === 'message' ? 'messageAgents' : 'invokeAgents'] &&
    (task.mode !== 'workflow' || permissions.manageWorkflow)
  );
}
export async function drainTasks(this: CrewContext): Promise<void> {
  if (this.closing) return;
  if (this.draining) {
    this.drainAgain = true;
    return;
  }
  this.draining = true;
  try {
    for (const task of this.board.list<AgentTask>('task').filter((t) => t.status === 'queued')) {
      if (this.closing) break;
      const parent = this.board.get<Run>('run', task.parentRunId);
      if (parent.status === 'running') continue;
      if (parent.status !== 'completed') {
        this.board.record(
          'task',
          { ...task, status: 'cancelled', error: 'The parent run did not complete.' },
          'system',
          'Cancelled crew follow-up',
        );
        continue;
      }
      if (!this.taskPermissionsAllow(task)) {
        this.board.record(
          'task',
          { ...task, status: 'cancelled', error: 'The originating role’s capabilities changed.' },
          'system',
          'Cancelled crew follow-up after settings change',
        );
        continue;
      }
      if (
        this.board
          .list<Run>('run')
          .some((r) => r.roleId === task.roleId && r.status === 'running') ||
        (task.cardId && this.board.hasActiveRun(task.cardId) && task.mode === 'workflow')
      )
        continue;
      try {
        const run =
          task.mode === 'workflow'
            ? await this.startRun(task.cardId!, task.roleId, task)
            : await this.startChatRun(task.roleId, task.content, task.cardId, task.threadId, task);
        this.board.record(
          'task',
          { ...task, status: 'running', runId: run.id },
          'orchestrator',
          `Started queued ${task.roleId} ${task.mode}`,
        );
      } catch (error) {
        if (this.board.get<AgentTask>('task', task.id).status === 'cancelled') continue;
        const message = error instanceof Error ? error.message : 'Could not start crew task.';
        this.board.record('task', { ...task, status: 'failed', error: message }, 'system', message);
        this.addMessage('crew', 'system', task.roleId, message, task.cardId, task.parentRunId);
      }
    }
  } finally {
    this.draining = false;
    if (this.drainAgain) {
      this.drainAgain = false;
      void this.drainTasks();
    }
  }
}
