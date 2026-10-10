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
          .list<Run>('run')
          .some(
            (run) =>
              (run.status === 'running' ||
                (run.status === 'waiting' &&
                  (run.routineId === routine.id ||
                    run.threadId === routine.conversationId ||
                    (routine.lastRunId && run.rootRunId === routine.lastRunId)))) &&
              (run.roleId === role.id ||
                run.routineId === routine.id ||
                (routine.lastRunId && run.rootRunId === routine.lastRunId)),
          )
      )
        continue;
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
      const scheduledFor = routine.nextRunAt;
      // Consume the occurrence before launching: a crash cannot replay it or spend tokens twice.
      const runCount = routine.runCount + 1;
      const nextRunAt =
        routine.maxRuns && runCount >= routine.maxRuns
          ? null
          : nextOccurrence(routine, now.toISOString());
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
        const run = await this.startChatRun(
          role.id,
          routine.content,
          routine.cardId,
          routine.conversationId ??
            relatedConversation(this, 'routine', routine.id, role.id, routine.cardId, routine.name)
              .id,
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
