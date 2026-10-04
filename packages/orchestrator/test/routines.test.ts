import { adapters } from '@pitchcrew/adapters';
import {
  defaultCapabilities,
  type Role,
  type Routine,
  type RoutineInput,
  type Run,
  type Snapshot,
} from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { createDaemon } from '../src/server.ts';
import { nextOccurrence, parseRoutine } from '../src/crew/routines/schedule.ts';
import { cleanup, finish, resources, setup, waitForSnapshot } from './helpers/daemon.ts';

afterEach(cleanup);
const input: RoutineInput = {
  name: 'Fictional check-in',
  roleId: 'scout',
  content: 'Review fictional applications.',
  cardId: null,
  startAt: '2030-01-01T09:00:00Z',
  timezone: 'UTC',
  cron: null,
  intervalMinutes: null,
  maxRuns: null,
  endsAt: null,
  enabled: true,
};
const at = (time: string) => new Date(`2030-01-01T${time}:00Z`);
const stored = (daemon: Awaited<ReturnType<typeof createDaemon>>, id: string) =>
  daemon.service.board.get<Routine>('routine', id);

it('validates deterministic cron, timezone, repeat bounds and calendar daylight-saving times', () => {
  expect(() => parseRoutine({ ...input, timezone: 'Missing/Zone' })).toThrow('timezone');
  expect(() => parseRoutine({ ...input, intervalMinutes: 0 })).toThrow();
  expect(() => parseRoutine({ ...input, intervalMinutes: 5, cron: '* * * * *' })).toThrow();
  expect(() => parseRoutine({ ...input, cron: '* * * * * *' })).toThrow('five-field');
  expect(() => parseRoutine({ ...input, cron: 'H * * * *' })).toThrow('deterministic');
  expect(() => parseRoutine({ ...input, cron: '0 99 * * *' })).toThrow();
  expect(() => parseRoutine({ ...input, endsAt: '2029-01-01T00:00:00Z' })).toThrow();
  const calendar = parseRoutine({
    ...input,
    startAt: '2030-03-09T14:00:00Z',
    timezone: 'America/New_York',
    cron: '0 9 * * *',
  });
  expect(nextOccurrence(calendar)).toBe('2030-03-09T14:00:00.000Z');
  expect(nextOccurrence(calendar, calendar.startAt)).toBe('2030-03-10T13:00:00.000Z');
  const monthly = parseRoutine({ ...input, startAt: '2030-01-31T09:00:00Z', cron: '0 9 31 * *' });
  expect(nextOccurrence(monthly, monthly.startAt)).toBe('2030-03-31T09:00:00.000Z');
});

it('launches a one-time action exactly once with saved chat, scoped tools and current role settings', async () => {
  const chat = vi
    .spyOn(adapters.demo, 'chat')
    .mockResolvedValue({ reply: 'Fictional check complete.' });
  const { daemon, request } = await setup(14530);
  const { result: routine } = await request<Routine>('/routines', 'POST', input);
  expect(routine.nextRunAt).toBe('2030-01-01T09:00:00.000Z');
  await daemon.service.tickRoutines(at('08:59'));
  expect(chat).not.toHaveBeenCalled();
  const role = daemon.service.board.get<Role>('role', 'scout');
  await daemon.service.configureRole('scout', {
    ...role,
    model: 'fictional-model',
    instructions: 'Updated fictional instructions.',
  });
  await daemon.service.tickRoutines(at('09:00'));
  const dispatched = stored(daemon, routine.id);
  expect(dispatched).toMatchObject({ runCount: 1, nextRunAt: null });
  const snapshot = await finish(request, dispatched.lastRunId!);
  expect(chat).toHaveBeenCalledTimes(1);
  expect(chat.mock.calls[0][0]).toMatchObject({
    request: input.content,
    role: { model: 'fictional-model', instructions: 'Updated fictional instructions.' },
  });
  expect(snapshot.runs[0]).toMatchObject({
    routineId: routine.id,
    scheduledFor: routine.nextRunAt,
    mode: 'chat',
    status: 'completed',
  });
  expect(snapshot.messages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        from: 'system',
        content: expect.stringContaining('Scheduled action'),
      }),
      expect.objectContaining({ from: 'scout', to: 'user', content: 'Fictional check complete.' }),
    ]),
  );
  expect(snapshot.approvals).toEqual([]);
  expect(snapshot.computerApprovals).toEqual([]);
  await daemon.service.tickRoutines(at('10:00'));
  expect(chat).toHaveBeenCalledTimes(1);
  await request(`/routines/${routine.id}`, 'PUT', {
    ...input,
    name: 'Renamed completed action',
    startAt: '2030-01-01T11:00:00+02:00',
  });
  await daemon.service.tickRoutines(at('10:01'));
  expect(chat).toHaveBeenCalledTimes(1);
  daemon.service.board.rebuild();
  expect(stored(daemon, routine.id).runCount).toBe(1);
  expect(
    daemon.service.board
      .events()
      .filter((event) => event.kind === 'routine')
      .every((event) => event.version === 10),
  ).toBe(true);
});

it('automatically dispatches a due action while the daemon is listening', async () => {
  vi.spyOn(adapters.demo, 'chat').mockResolvedValue({ reply: 'Automatic fictional check.' });
  const { request } = await setup(14536);
  const { result: routine } = await request<Routine>('/routines', 'POST', {
    ...input,
    startAt: new Date(Date.now() - 1000).toISOString(),
  });
  const snapshot = await waitForSnapshot(
    request,
    (snapshot) =>
      snapshot.routines.some(
        (candidate) => candidate.id === routine.id && candidate.runCount === 1,
      ) && snapshot.runs.some((run) => run.routineId === routine.id && run.status === 'completed'),
  );
  expect(snapshot.runs.filter((run) => run.routineId === routine.id)).toHaveLength(1);
});

it('coalesces missed intervals, bounds total dispatches, and does not overlap busy roles', async () => {
  let complete!: (result: { reply: string }) => void;
  const chat = vi.spyOn(adapters.demo, 'chat').mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const { daemon, request } = await setup(14531);
  const routine = daemon.service.saveRoutine({ ...input, intervalMinutes: 5, maxRuns: 2 });
  await Promise.all([
    daemon.service.tickRoutines(at('09:23')),
    daemon.service.tickRoutines(at('09:23')),
  ]);
  expect(stored(daemon, routine.id)).toMatchObject({
    runCount: 1,
    nextRunAt: '2030-01-01T09:25:00.000Z',
  });
  await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
  await daemon.service.tickRoutines(at('09:30'));
  expect(chat).toHaveBeenCalledTimes(1);
  complete({ reply: 'First fictional check.' });
  await finish(request, stored(daemon, routine.id).lastRunId!);
  chat.mockResolvedValue({ reply: 'Second fictional check.' });
  await daemon.service.tickRoutines(at('09:31'));
  await finish(request, stored(daemon, routine.id).lastRunId!);
  expect(stored(daemon, routine.id)).toMatchObject({ runCount: 2, nextRunAt: null });
  await daemon.service.tickRoutines(at('10:00'));
  expect(chat).toHaveBeenCalledTimes(2);
});

it('pauses, resumes, expires duration limits and deletes without resurrecting replayed routines', async () => {
  const chat = vi.spyOn(adapters.demo, 'chat').mockResolvedValue({ reply: 'Fictional reply.' });
  const { daemon, request } = await setup(14532);
  const paused = daemon.service.saveRoutine({ ...input, enabled: false });
  const expired = daemon.service.saveRoutine({
    ...input,
    name: 'Expired',
    intervalMinutes: 5,
    endsAt: '2030-01-01T09:10:00Z',
  });
  const removed = daemon.service.saveRoutine({ ...input, name: 'Removed' });
  await request(`/routines/${removed.id}`, 'DELETE');
  await daemon.service.tickRoutines(at('09:15'));
  expect(chat).not.toHaveBeenCalled();
  expect(stored(daemon, expired.id).nextRunAt).toBeNull();
  const { result: snapshot } = await request<Snapshot>('/snapshot');
  expect(snapshot.routines.map((routine) => routine.id)).not.toContain(removed.id);
  const { response } = await request(`/routines/${removed.id}`, 'PUT', input);
  expect(response.status).toBe(400);
  await request(`/routines/${paused.id}`, 'PUT', input);
  await daemon.service.tickRoutines(at('09:20'));
  await finish(request, stored(daemon, paused.id).lastRunId!);
  daemon.service.board.rebuild();
  expect(stored(daemon, removed.id).deletedAt).not.toBeNull();
  expect(chat).toHaveBeenCalledTimes(1);
});

it('uses run-scoped chat tools for self and cross-agent CRUD and rechecks revoked capabilities', async () => {
  const { daemon, request } = await setup(14533);
  // A board-backed capability fixture keeps the test independent of inference.
  const run: Run = {
    id: 'routine-fixture',
    roleId: 'scout',
    runtime: 'demo',
    cardId: null,
    status: 'running',
    message: 'Fixture',
    startedAt: '',
    finishedAt: null,
  };
  daemon.service.board.record('run', run, 'system', 'Fixture');
  daemon.service.capabilities.set('routine-token', {
    runId: run.id,
    roleId: 'scout',
    cardId: null,
  });
  const call = (action: string, data: Record<string, unknown> = {}) =>
    daemon.service.agentCall('routine-token', action, data);
  const { routine } = (await call('save_routine', { input: { ...input, roleId: 'writer' } })) as {
    routine: Routine;
  };
  expect(routine).toMatchObject({ createdBy: 'scout', updatedBy: 'scout', roleId: 'writer' });
  await call('save_routine', {
    routineId: routine.id,
    input: { ...input, roleId: 'writer', name: 'Edited by another agent' },
  });
  expect(await call('routines')).toMatchObject({
    routines: [expect.objectContaining({ name: 'Edited by another agent' })],
    now: expect.any(String),
    timezone: expect.any(String),
  });
  const source = daemon.service.board.get<Role>('role', 'scout');
  const restricted = {
    ...source,
    capabilities: { ...defaultCapabilities, invokeAgents: false, manageRoutines: false },
  };
  daemon.service.board.record('role', restricted, 'user', 'Revoked fixture capabilities');
  await expect(call('save_routine', { input })).rejects.toThrow('disabled');
  await expect(call('delete_routine', { routineId: routine.id })).rejects.toThrow('disabled');
  expect(await call('routines')).toMatchObject({ routines: [] });
  await daemon.service.tickRoutines(at('09:00'));
  expect(stored(daemon, routine.id).runCount).toBe(0);
  daemon.service.board.record(
    'role',
    { ...source, capabilities: { ...defaultCapabilities, invokeAgents: false } },
    'user',
    'Restore own schedule capability',
  );
  await expect(call('save_routine', { input: { ...input, roleId: 'writer' } })).rejects.toThrow(
    'other roles',
  );
  const own = (await call('save_routine', { input })) as { routine: Routine };
  await call('delete_routine', { routineId: own.routine.id });
  const otherCard = daemon.service.createCard({
    company: 'Fictional Studio',
    title: 'Fictional job',
  });
  await expect(call('save_routine', { input: { ...input, cardId: otherCard.id } })).rejects.toThrow(
    'attached application',
  );
  // A user edit explicitly takes responsibility, so old author permissions no longer block it.
  const chat = vi
    .spyOn(adapters.demo, 'chat')
    .mockResolvedValue({ reply: 'Fictional scheduled writer.' });
  await request(`/routines/${routine.id}`, 'PUT', { ...input, roleId: 'writer' });
  await daemon.service.tickRoutines(at('09:01'));
  await finish(request, stored(daemon, routine.id).lastRunId!);
  expect(chat).toHaveBeenCalledTimes(1);
  daemon.service.capabilities.delete('routine-token');
  await expect(call('routines')).rejects.toThrow('expired');
});

it('persists schedules across restart and never replays an already dispatched occurrence', async () => {
  const chat = vi
    .spyOn(adapters.demo, 'chat')
    .mockResolvedValue({ reply: 'Fictional scheduled check.' });
  const { daemon, directory, request } = await setup(14534);
  const once = daemon.service.saveRoutine(input);
  const repeat = daemon.service.saveRoutine({
    ...input,
    roleId: 'writer',
    name: 'Repeating check',
    intervalMinutes: 60,
  });
  await daemon.service.tickRoutines(at('09:00'));
  await finish(request, stored(daemon, once.id).lastRunId!);
  await finish(request, stored(daemon, repeat.id).lastRunId!);
  await daemon.close();
  resources.pop();
  const restarted = await createDaemon({ dev: true, directory, port: 14534, seedSkills: false });
  resources.push({ daemon: restarted, directory });
  expect(restarted.service.routines()).toHaveLength(2);
  await restarted.service.tickRoutines(at('09:30'));
  expect(chat).toHaveBeenCalledTimes(2);
  await restarted.service.tickRoutines(at('12:30'));
  await vi.waitFor(() =>
    expect(
      restarted.service.board
        .list<Run>('run')
        .filter((run) => run.routineId === repeat.id && run.status === 'completed'),
    ).toHaveLength(2),
  );
  expect(stored(restarted, repeat.id)).toMatchObject({
    runCount: 2,
    nextRunAt: '2030-01-01T13:00:00.000Z',
  });
  expect(stored(restarted, once.id).runCount).toBe(1);
});

it('does not launch paused or unavailable roles and does not cancel active runs on delete', async () => {
  let complete!: (result: { reply: string }) => void;
  vi.spyOn(adapters.demo, 'chat').mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const { daemon, request } = await setup(14535);
  const routine = daemon.service.saveRoutine(input);
  const role = daemon.service.board.get<Role>('role', 'scout');
  daemon.service.board.record('role', { ...role, enabled: false }, 'user', 'Paused');
  await daemon.service.tickRoutines(at('09:00'));
  expect(stored(daemon, routine.id).runCount).toBe(0);
  daemon.service.board.record('role', role, 'user', 'Resumed');
  const runtime = daemon.service.runtimes.find((runtime) => runtime.id === 'demo')!;
  runtime.available = false;
  await daemon.service.tickRoutines(at('09:01'));
  expect(stored(daemon, routine.id).runCount).toBe(0);
  runtime.available = true;
  await daemon.service.tickRoutines(at('09:02'));
  await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
  const runId = stored(daemon, routine.id).lastRunId!;
  daemon.service.deleteRoutine(routine.id);
  expect(daemon.service.board.get<Run>('run', runId).status).toBe('running');
  complete({ reply: 'Finished the existing action.' });
  await finish(request, runId);
  expect(stored(daemon, routine.id).deletedAt).not.toBeNull();
  expect(daemon.service.routines()).toEqual([]);
});
