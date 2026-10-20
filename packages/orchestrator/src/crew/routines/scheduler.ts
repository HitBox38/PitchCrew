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

export function startScheduler(this: CrewContext): void {
  if (this.schedulerTimer || this.closing) return;
  this.schedulerTimer = setInterval(() => {
    void tickRoutines.call(this);
  }, 1000);
  this.schedulerTimer.unref();
}

export async function tickRoutines(this: CrewContext, now = new Date()): Promise<void> {
  if (this.closing || this.initializing || this.scheduling) return;
  this.scheduling = true;
  try {
    await this.runtimeMaintenance.recover();
    await this.drainTasks();
    await drainConversationQueue(this);
    for (const candidate of routines
      .call(this)
      .sort(
        (a, b) => Date.parse(a.nextRunAt ?? a.createdAt) - Date.parse(b.nextRunAt ?? b.createdAt),
      )) {
      if (this.closing) break;
      const routine = this.board.get<Routine>('routine', candidate.id);
      if (routine.deletedAt) continue;
      if (routine.conversationId) {
        const target = conversation(this, routine.conversationId);
        if (!target.participants.includes(routine.roleId) || target.cardId !== routine.cardId)
          continue;
      }
      if (!routine.enabled || !routine.nextRunAt || Date.parse(routine.nextRunAt) > now.getTime())
        continue;
      if (routine.endsAt && Date.parse(routine.endsAt) < now.getTime()) {
        this.board.record(
          'routine',
          { ...routine, nextRunAt: null, updatedAt: now.toISOString() },
          'system',
          `Routine ended: ${routine.name}`,
        );
        continue;
      }
      const role = this.board.get<Role>('role', routine.roleId);
      if (
        !role.enabled ||
        role.retiredAt ||
        this.profileWriting ||
        profileUpdateInterrupted(this) ||
        this.configuring.has(role.id) ||
        !this.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available)
      )
        continue;
      if (
        this.board
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
        this.board
          .list<Run>('run')
          .some(
            (run) =>
              ['running', 'waiting'].includes(run.status) &&
              (run.routineId === routine.id ||
                (routine.lastRunId && run.rootRunId === routine.lastRunId)),
          )
      )
        continue;
      if (!routine.cardId && activeQueues(this).size >= concurrency(this)) continue;
      if (
        routine.lastRunId &&
        this.board
          .list<AgentTask>('task')
          .some(
            (task) =>
              task.rootRunId === routine.lastRunId &&
              ['queued', 'running', 'waiting'].includes(task.status),
          )
      )
        continue;
      if (routine.updatedBy !== 'user') {
        const source = this.board.get<Role>('role', routine.updatedBy);
        const permissions = { ...defaultCapabilities, ...source.capabilities };
        if (
          !source.enabled ||
          source.retiredAt ||
          !permissions.manageRoutines ||
          (source.id !== role.id && !permissions.invokeAgents)
        )
          continue;
      }
      if (this.runtimeMaintenance.held(role)) continue;
      try {
        const auth = await this.runtimeMaintenance.authenticate(role);
        if (auth.status === 'missing' || this.runtimeMaintenance.isUpdating(role.runtime)) continue;
      } catch {
        continue;
      }
      if (this.board.get<Routine>('routine', routine.id).updatedAt !== routine.updatedAt) continue;
      const threadId =
        routine.conversationId ??
        relatedConversation(this, 'routine', routine.id, role.id, routine.cardId, routine.name).id;
      if (
        !routine.cardId &&
        (launchProblem(this, { cardId: null, threadId, roleId: role.id, routineId: routine.id }) ||
          !(await queueMayStart(this, `routine:${routine.id}`, routine.id)))
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
        this.board.record(
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
              ...this.board.list<ChatRequest>('chat_request').map((r) => r.order + 1),
            ),
            routine: { routineId: routine.id, scheduledFor },
            deliveries: [{ roleId: role.id, status: 'queued', runId: null, error: '' }],
          };
          this.board.db.transaction(() => {
            consume();
            this.addMessage(
              threadId,
              'system',
              role.id,
              `Scheduled action: ${routine.content}`,
              routine.cardId,
              null,
              request.messageId,
            );
            saveRequest(this, request);
          })();
          await drainConversationQueue(this);
          continue;
        }
        consume();
        const run = await this.startChatRun(
          role.id,
          routine.content,
          routine.cardId,
          threadId,
          undefined,
          { routineId: routine.id, scheduledFor },
        );
        const latest = this.board.get<Routine>('routine', routine.id);
        this.board.record(
          'routine',
          { ...latest, lastRunId: run.id },
          'system',
          `Started routine: ${routine.name}`,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not start the scheduled action.';
        const latest = this.board.get<Routine>('routine', routine.id);
        this.board.record(
          'routine',
          { ...latest, error: message },
          'system',
          `Routine failed: ${routine.name}`,
        );
        this.addMessage(
          routine.conversationId ??
            relatedConversation(this, 'routine', routine.id, role.id, routine.cardId, routine.name)
              .id,
          'system',
          role.id,
          `Routine “${routine.name}” could not start: ${message}`,
          routine.cardId,
          null,
        );
      }
    }
  } finally {
    this.scheduling = false;
  }
}
