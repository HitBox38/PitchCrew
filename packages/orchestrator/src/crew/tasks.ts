import { waitingOnUser } from './user-input/lifecycle.ts';
import {
  agentDm,
  canReadConversation,
  relatedConversation,
  conversation,
} from './conversations.ts';
import { drainConversationQueue } from './conversation-queue.ts';
import { routineReadyBefore } from './routines/ready.ts';
import { requireRole } from './roles.ts';
import {
  defaultCapabilities,
  type AgentTask,
  type Role,
  type RoleId,
  type Run,
  type Routine,
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
  conversationId?: string,
): AgentTask {
  const parent = this.board.get<Run>('run', capability.runId);
  const rootRunId = parent.rootRunId ?? parent.id;
  const role = requireRole(this, roleId);
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
    threadId:
      conversationId ??
      (mode === 'workflow'
        ? relatedConversation(
            this,
            'application',
            capability.cardId!,
            roleId,
            capability.cardId,
            'Application work',
          ).id
        : agentDm(this, capability.roleId, roleId, capability.cardId, parent.threadId).id),
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
  this.addMessage(task.threadId, capability.roleId, roleId, content, capability.cardId, parent.id);
  // Children start after their parent finishes, so a self-invocation never shares a session.
  return task;
}
export function finishTask(this: CrewContext, run: Run): void {
  const finished = this.board.get<Run>('run', run.id);
  if (run.routineId) {
    const routine = this.board.get<Routine>('routine', run.routineId);
    this.board.record(
      'routine',
      {
        ...routine,
        error: ['completed', 'waiting'].includes(finished.status) ? '' : finished.message,
      },
      run.roleId,
      `Routine ${finished.status}: ${routine.name}`,
    );
  }
  if (run.taskId) {
    const task = this.board.get<AgentTask>('task', run.taskId);
    this.board.record(
      'task',
      {
        ...task,
        status:
          finished.status === 'waiting'
            ? 'waiting'
            : finished.status === 'completed'
              ? 'completed'
              : finished.status === 'cancelled'
                ? 'cancelled'
                : 'failed',
        error: ['completed', 'waiting'].includes(finished.status) ? '' : finished.message,
      },
      run.roleId,
      `${run.roleId} ${finished.status} a crew task`,
    );
  }
  if (run.mode === 'workflow' && finished.status !== 'waiting')
    this.addMessage(
      run.threadId ?? 'crew',
      run.roleId,
      'crew',
      workflowResultMessage(this, finished),
      run.cardId,
      run.id,
    );
}
export function taskPermissionsAllow(this: CrewContext, task: AgentTask): boolean {
  const parent = this.board.get<Run>('run', task.parentRunId);
  const source = this.board.get<Role>('role', parent.roleId);
  const permissions = source.capabilities ?? defaultCapabilities;
  return (
    canReadConversation(this, task.roleId, task.threadId) &&
    source.enabled &&
    !source.retiredAt &&
    permissions[task.trigger === 'message' ? 'messageAgents' : 'invokeAgents'] &&
    (task.mode !== 'workflow' || permissions.manageWorkflow)
  );
}
export async function drainTasks(this: CrewContext): Promise<void> {
  if (this.closing || this.initializing) return;
  if (this.draining) {
    this.drainAgain = true;
    return;
  }
  this.draining = true;
  try {
    for (const task of this.board.list<AgentTask>('task').filter((t) => t.status === 'queued')) {
      if (this.closing) break;
      const parent = this.board.get<Run>('run', task.parentRunId);
      if (
        ['running', 'waiting'].includes(parent.status) ||
        waitingOnUser(this, task.threadId, task.roleId)
      )
        continue;
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
      if (routineReadyBefore(this, task.roleId, Date.parse(task.createdAt))) continue;
      if (
        this.board
          .list<import('@pitchcrew/core').ChatRequest>('chat_request')
          .some(
            (request) =>
              request.order < Date.parse(task.createdAt) &&
              canReadConversation(this, task.roleId, request.threadId) &&
              this.runtimes.some(
                (runtime) =>
                  runtime.available &&
                  runtime.id ===
                    (conversation(this, request.threadId).configurations[task.roleId]?.runtime ??
                      requireRole(this, task.roleId).runtime),
              ) &&
              request.deliveries.some(
                (delivery) => delivery.roleId === task.roleId && delivery.status === 'queued',
              ),
          )
      )
        continue;
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
        this.addMessage(
          task.threadId,
          'system',
          task.roleId,
          message,
          task.cardId,
          task.parentRunId,
        );
      }
    }
  } finally {
    this.draining = false;
    void drainConversationQueue(this);
    if (this.drainAgain) {
      this.drainAgain = false;
      void this.drainTasks();
    }
  }
}

function workflowResultMessage(context: CrewContext, run: Run): string {
  if (run.status !== 'completed' || !run.cardId) return run.message;
  const card = context.board.get<import('@pitchcrew/core').Card>('card', run.cardId);
  const role = requireRole(context, run.roleId);
  const seat = role.workflow ?? role.id;
  if (seat === 'scout')
    return `${role.name} assessed job fit${card.fit === null ? '' : `: ${card.fit}/100`}. ${card.feedback.slice(0, 3).join(' ')} Open the job for the saved assessment.`;
  if (seat === 'writer')
    return `${role.name} saved an application packet. It is ready for review; open the job to read the draft.`;
  return `${role.name} ${card.state === 'agreed' ? 'approved the packet' : 'requested changes'}. ${card.feedback.slice(0, 3).join(' ')} Open the job for the saved review.`;
}
