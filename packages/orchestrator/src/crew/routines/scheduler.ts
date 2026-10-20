import { launchProblem } from '../queue/admission.ts';
import { queueMayStart } from '../queue/dispatch.ts';
import { randomUUID } from 'node:crypto';
import { saveRequest } from '../conversation-queue.ts';
import { activeQueues, concurrency } from '../queue/state.ts';
import { type ChatRequest } from '@pitchcrew/core';
import { drainConversationQueue } from '../conversation-queue.ts';
import { relatedConversation, conversation } from '../conversations.ts';
import { profileUpdateInterrupted } from '../../profile-sources/mutation.ts';
import {
  defaultCapabilities,
  type AgentTask,
  type Role,
  type Routine,
  type Run,
} from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';
import { nextOccurrence } from './schedule.ts';
import { routines } from './index.ts';

export const startScheduler = (context: CrewContext): void => {
  if (context.schedulerTimer || context.closing) return;
  context.schedulerTimer = setInterval(() => {
    void tickRoutines(context);
  }, 1000);
  context.schedulerTimer.unref();
};

export const tickRoutines = async (context: CrewContext, now = new Date()): Promise<void> => {
  if (context.closing || context.initializing || context.scheduling) return;
  context.scheduling = true;
  try {
    await context.runtimeMaintenance.recover();
    await context.drainTasks();
    await drainConversationQueue(context);
    for (const candidate of routines(context).sort(
      (a, b) => Date.parse(a.nextRunAt ?? a.createdAt) - Date.parse(b.nextRunAt ?? b.createdAt),
    )) {
      if (context.closing) break;
      const routine = context.board.get<Routine>('routine', candidate.id);
      if (routine.deletedAt) continue;
      if (routine.conversationId) {
        const target = conversation(context, routine.conversationId);
        if (!target.participants.includes(routine.roleId) || target.cardId !== routine.cardId)
          continue;
      }
      if (!routine.enabled || !routine.nextRunAt || Date.parse(routine.nextRunAt) > now.getTime())
        continue;
      if (routine.endsAt && Date.parse(routine.endsAt) < now.getTime()) {
        context.board.record(
          'routine',
          { ...routine, nextRunAt: null, updatedAt: now.toISOString() },
          'system',
          `Routine ended: ${routine.name}`,
        );
        continue;
      }
      const role = context.board.get<Role>('role', routine.roleId);
      if (
        !role.enabled ||
        role.retiredAt ||
        context.profileWriting ||
        profileUpdateInterrupted(context) ||
        context.configuring.has(role.id) ||
        !context.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available)
      )
        continue;
      if (
        context.board
          .list<ChatRequest>('chat_request')
          .some(
            (r) =>
              r.routine?.routineId === routine.id &&
              r.deliveries.some((d) =>
                ['queued', 'running', 'waiting', 'paused', 'failed'].includes(d.status),
              ),
          )
      )
        continue;
      if (
        context.board
          .list<Run>('run')
          .some(
            (run) =>
              ['running', 'waiting'].includes(run.status) &&
              (run.routineId === routine.id ||
                (routine.lastRunId && run.rootRunId === routine.lastRunId)),
          )
      )
        continue;
      if (!routine.cardId && activeQueues(context).size >= concurrency(context)) continue;
      if (
        routine.lastRunId &&
        context.board
          .list<AgentTask>('task')
          .some(
            (task) =>
              task.rootRunId === routine.lastRunId &&
              ['queued', 'running', 'waiting'].includes(task.status),
          )
      )
        continue;
      if (routine.updatedBy !== 'user') {
        const source = context.board.get<Role>('role', routine.updatedBy);
        const permissions = { ...defaultCapabilities, ...source.capabilities };
        if (
          !source.enabled ||
          source.retiredAt ||
          !permissions.manageRoutines ||
          (source.id !== role.id && !permissions.invokeAgents)
        )
          continue;
      }
      if (context.runtimeMaintenance.held(role)) continue;
      try {
        const auth = await context.runtimeMaintenance.authenticate(role);
        if (auth.status === 'missing' || context.runtimeMaintenance.isUpdating(role.runtime))
          continue;
      } catch {
        continue;
      }
      if (context.board.get<Routine>('routine', routine.id).updatedAt !== routine.updatedAt)
        continue;
      const threadId =
        routine.conversationId ??
        relatedConversation(context, 'routine', routine.id, role.id, routine.cardId, routine.name)
          .id;
      if (
        !routine.cardId &&
        (launchProblem(context, {
          cardId: null,
          threadId,
          roleId: role.id,
          routineId: routine.id,
        }) ||
          !(await queueMayStart(context, `routine:${routine.id}`, routine.id)))
      )
        continue;
      const scheduledFor = routine.nextRunAt;
      // Job occurrences commit with their queued request; background work consumes before launch.
      const runCount = routine.runCount + 1;
      const nextRunAt =
        routine.maxRuns && runCount >= routine.maxRuns
          ? null
          : nextOccurrence(routine, now.toISOString());
      const consume = () =>
        context.board.record(
          'routine',
          {
            ...routine,
            runCount,
            nextRunAt,
            lastScheduledAt: scheduledFor,
            error: '',
            updatedAt: now.toISOString(),
          },
          'system',
          `Dispatched routine: ${routine.name}`,
        );
      try {
        if (routine.cardId) {
          const request: ChatRequest = {
            id: randomUUID(),
            messageId: randomUUID(),
            threadId,
            content: routine.content,
            attachments: [],
            createdAt: now.toISOString(),
            order: Math.max(
              Date.now(),
              ...context.board.list<ChatRequest>('chat_request').map((r) => r.order + 1),
            ),
            routine: { routineId: routine.id, scheduledFor },
            deliveries: [{ roleId: role.id, status: 'queued', runId: null, error: '' }],
          };
          context.board.db.transaction(() => {
            consume();
            context.addMessage(
              threadId,
              'system',
              role.id,
              `Scheduled action: ${routine.content}`,
              routine.cardId,
              null,
              request.messageId,
            );
            saveRequest(context, request);
          })();
          await drainConversationQueue(context);
          continue;
        }
        consume();
        const run = await context.startChatRun(
          role.id,
          routine.content,
          routine.cardId,
          threadId,
          undefined,
          { routineId: routine.id, scheduledFor },
        );
        const latest = context.board.get<Routine>('routine', routine.id);
        context.board.record(
          'routine',
          { ...latest, lastRunId: run.id },
          'system',
          `Started routine: ${routine.name}`,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not start the scheduled action.';
        const latest = context.board.get<Routine>('routine', routine.id);
        context.board.record(
          'routine',
          { ...latest, error: message },
          'system',
          `Routine failed: ${routine.name}`,
        );
        context.addMessage(
          routine.conversationId ??
            relatedConversation(
              context,
              'routine',
              routine.id,
              role.id,
              routine.cardId,
              routine.name,
            ).id,
          'system',
          role.id,
          `Routine “${routine.name}” could not start: ${message}`,
          routine.cardId,
          null,
        );
      }
    }
  } finally {
    context.scheduling = false;
  }
};
