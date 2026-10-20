import { queueMayStart } from './queue/dispatch.ts';
import { patchQueue, taskLane } from './queue/state.ts';
import { launchProblem, QueueBusyError } from './queue/admission.ts';
import { RuntimeHeldError } from '../runtime-maintenance/availability.ts';
import { waitingOnUser } from './user-input/lifecycle.ts';
import {
  agentDm,
  canReadConversation,
  relatedConversation,
  conversation,
} from './conversations.ts';
import { drainConversationQueue } from './conversation-queue.ts';
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

export const enqueue = (
  context: CrewContext,
  capability: { runId: string; cardId: string | null; roleId: RoleId },
  roleId: RoleId,
  mode: AgentTask['mode'],
  content: string,
  trigger: AgentTask['trigger'],
  conversationId?: string,
): AgentTask => {
  const parent = context.board.get<Run>('run', capability.runId);
  const rootRunId = parent.rootRunId ?? parent.id;
  const role = requireRole(context, roleId);
  if (!role.enabled) throw new Error('The target role is paused.');
  if (!context.runtimes.find((r) => r.id === role.runtime)?.available)
    throw new Error('The target runtime is not available.');
  if (mode === 'workflow' && !capability.cardId)
    throw new Error('Attach a job before invoking a workflow.');
  if (context.board.list<AgentTask>('task').filter((t) => t.rootRunId === rootRunId).length >= 6)
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
            context,
            'application',
            capability.cardId!,
            roleId,
            capability.cardId,
            'Application work',
          ).id
        : agentDm(context, capability.roleId, roleId, capability.cardId, parent.threadId).id),
    content,
    status: 'queued',
    runId: null,
    error: '',
    createdAt: new Date().toISOString(),
  };
  context.board.record(
    'task',
    task,
    capability.roleId,
    `${capability.roleId} queued ${roleId} ${mode}`,
  );
  context.addMessage(
    task.threadId,
    capability.roleId,
    roleId,
    content,
    capability.cardId,
    parent.id,
  );
  // Children start after their parent finishes, so a self-invocation never shares a session.
  return task;
};
export const finishTask = (context: CrewContext, run: Run): void => {
  const finished = context.board.get<Run>('run', run.id);
  if (run.routineId) {
    const routine = context.board.get<Routine>('routine', run.routineId);
    context.board.record(
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
    const task = context.board.get<AgentTask>('task', run.taskId);
    context.board.record(
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
    context.addMessage(
      run.threadId ?? 'crew',
      run.roleId,
      'crew',
      workflowResultMessage(context, finished),
      run.cardId,
      run.id,
    );
};
export const taskPermissionsAllow = (context: CrewContext, task: AgentTask): boolean => {
  const parent = context.board.get<Run>('run', task.parentRunId);
  const source = context.board.get<Role>('role', parent.roleId);
  const permissions = source.capabilities ?? defaultCapabilities;
  return (
    canReadConversation(context, task.roleId, task.threadId) &&
    source.enabled &&
    !source.retiredAt &&
    permissions[task.trigger === 'message' ? 'messageAgents' : 'invokeAgents'] &&
    (task.mode !== 'workflow' || permissions.manageWorkflow)
  );
};
export const drainTasks = async (context: CrewContext): Promise<void> => {
  if (context.closing || context.initializing) return;
  if (context.draining) {
    context.drainAgain = true;
    return;
  }
  context.draining = true;
  try {
    for (const task of context.board.list<AgentTask>('task').filter((t) => t.status === 'queued')) {
      if (context.closing) break;
      const parent = context.board.get<Run>('run', task.parentRunId);
      if (
        ['running', 'waiting'].includes(parent.status) ||
        waitingOnUser(context, task.threadId, task.roleId)
      )
        continue;
      if (parent.status !== 'completed') {
        context.board.record(
          'task',
          { ...task, status: 'cancelled', error: 'The parent run did not complete.' },
          'system',
          'Cancelled crew follow-up',
        );
        continue;
      }
      if (!context.taskPermissionsAllow(task)) {
        context.board.record(
          'task',
          { ...task, status: 'cancelled', error: 'The originating role’s capabilities changed.' },
          'system',
          'Cancelled crew follow-up after settings change',
        );
        continue;
      }
      if (
        task.cardId &&
        context.board
          .list<Run>('run')
          .some(
            (r) =>
              r.cardId === task.cardId && (r.status === 'running' || context.controllers.has(r.id)),
          )
      )
        continue;
      const taskRole = requireRole(context, task.roleId);
      const taskConfig =
        task.mode === 'workflow'
          ? taskRole
          : { ...taskRole, ...conversation(context, task.threadId).configurations[task.roleId] };
      if (context.runtimeMaintenance.held(taskConfig)) {
        context.queueChains.delete(taskLane(context, task));
        continue;
      }
      if (
        launchProblem(context, {
          cardId: task.cardId,
          threadId: task.threadId,
          roleId: task.roleId,
          rootRunId: task.rootRunId,
        })
      )
        continue;
      if (!(await queueMayStart(context, taskLane(context, task), task.rootRunId))) continue;
      try {
        const run =
          task.mode === 'workflow'
            ? await context.startRun(task.cardId!, task.roleId, task)
            : await context.startChatRun(
                task.roleId,
                task.content,
                task.cardId,
                task.threadId,
                task,
              );
        context.board.record(
          'task',
          { ...task, status: 'running', runId: run.id },
          'orchestrator',
          `Started queued ${task.roleId} ${task.mode}`,
        );
      } catch (error) {
        if (error instanceof RuntimeHeldError || error instanceof QueueBusyError) continue;
        if (context.board.get<AgentTask>('task', task.id).status === 'cancelled') continue;
        const message = error instanceof Error ? error.message : 'Could not start crew task.';
        context.board.record(
          'task',
          { ...task, status: 'failed', error: message },
          'system',
          message,
        );
        const queueId = taskLane(context, task);
        if (!queueId.startsWith('routine:'))
          patchQueue(context, queueId, {
            paused: true,
            pauseKind: 'failed',
            reason: message,
          });
        context.addMessage(
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
    context.draining = false;
    void drainConversationQueue(context);
    if (context.drainAgain) {
      context.drainAgain = false;
      void context.drainTasks();
    }
  }
};

const workflowResultMessage = (context: CrewContext, run: Run): string => {
  if (run.status !== 'completed' || !run.cardId) return run.message;
  const card = context.board.get<import('@pitchcrew/core').Card>('card', run.cardId);
  const role = requireRole(context, run.roleId);
  const seat = run.purpose === 'application-draft' ? 'writer' : (role.workflow ?? role.id);
  if (seat === 'scout')
    return `${role.name} assessed job fit${card.fit === null ? '' : `: ${card.fit}/100`}. ${card.feedback.slice(0, 3).join(' ')} Open the job for the saved assessment.`;
  if (seat === 'writer')
    return `${role.name} saved an application packet. It is ready for review; open the job to read the draft.`;
  return `${role.name} ${card.state === 'agreed' ? 'approved the packet' : 'requested changes'}. ${card.feedback.slice(0, 3).join(' ')} Open the job for the saved review.`;
};
