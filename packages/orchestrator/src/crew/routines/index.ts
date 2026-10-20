import { conversation } from '../conversations.ts';
import { requireRole } from '../roles.ts';
import { type Card, type RoleId, type Routine } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import type { CrewContext } from '../types.ts';
import { nextOccurrence, parseRoutine } from './schedule.ts';

export const routines = (context: CrewContext): Routine[] => {
  return context.board.list<Routine>('routine').filter((routine) => !routine.deletedAt);
};

export const saveRoutine = (
  context: CrewContext,
  data: unknown,
  id?: string,
  actor: 'user' | RoleId = 'user',
): Routine => {
  const input = parseRoutine(data);
  const current = id ? context.board.get<Routine>('routine', id) : undefined;
  if (current?.deletedAt) throw new Error('This routine was deleted.');
  requireRole(context, input.roleId);
  if (input.cardId) context.board.get<Card>('card', input.cardId);
  if (input.conversationId) {
    const target = conversation(context, input.conversationId);
    if (
      !target.participants.includes(input.roleId) ||
      target.cardId !== input.cardId ||
      ['history', 'agent_dm'].includes(target.kind)
    )
      throw new Error('Choose a writable conversation with this agent and the same job scope.');
  }
  const now = new Date().toISOString();
  const changed =
    !current ||
    input.startAt !== current.startAt ||
    input.cron !== current.cron ||
    input.intervalMinutes !== current.intervalMinutes ||
    input.timezone !== current.timezone;
  let nextRunAt = changed ? nextOccurrence(input) : current.nextRunAt;
  if (current && !changed && !nextRunAt && (input.cron || input.intervalMinutes))
    nextRunAt = nextOccurrence(input, current.lastScheduledAt ?? now);
  if (
    (input.maxRuns && (current?.runCount ?? 0) >= input.maxRuns) ||
    (input.endsAt && nextRunAt && Date.parse(nextRunAt) > Date.parse(input.endsAt))
  )
    nextRunAt = null;
  if (!current && !nextRunAt) throw new Error('This schedule has no occurrence before its end.');
  const routine: Routine = {
    ...input,
    id: current?.id ?? randomUUID(),
    createdBy: current?.createdBy ?? actor,
    updatedBy: actor,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
    runCount: current?.runCount ?? 0,
    nextRunAt,
    lastRunId: current?.lastRunId ?? null,
    lastScheduledAt: current?.lastScheduledAt ?? null,
    error: '',
  };
  context.board.record(
    'routine',
    routine,
    actor,
    `${current ? 'Updated' : 'Created'} routine: ${routine.name}`,
  );
  return routine;
};

export const deleteRoutine = (
  context: CrewContext,
  id: string,
  actor: 'user' | RoleId = 'user',
): { ok: boolean } => {
  const routine = context.board.get<Routine>('routine', id);
  if (!routine.deletedAt)
    context.board.record(
      'routine',
      {
        ...routine,
        enabled: false,
        nextRunAt: null,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      actor,
      `Deleted routine: ${routine.name}`,
    );
  return { ok: true };
};
