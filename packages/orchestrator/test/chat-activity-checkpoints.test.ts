import { Board } from '@pitchcrew/board';
import type { Run, RuntimeActivity } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  finishChatActivity,
  recordChatActivity,
  restoreActivityCheckpoints,
} from '../src/crew/chat-activity.ts';
import type { CrewContext } from '../src/crew/types.ts';

const boards: Board[] = [];
const directories: string[] = [];
const contexts: CrewContext[] = [];
const create = (filename = ':memory:') => {
  const board = new Board(filename);
  boards.push(board);
  const context = {
    board,
    runActivities: new Map(),
    controllers: new Map(),
    closing: false,
    publishChat: vi.fn(),
  } as unknown as CrewContext;
  contexts.push(context);
  return context;
};
const run: Run = {
  id: 'activity-run',
  cardId: null,
  roleId: 'scout',
  runtime: 'codex',
  status: 'running',
  message: '',
  startedAt: '2026-11-07T08:00:00.000Z',
  finishedAt: null,
  mode: 'chat',
  threadId: 'scout',
};
const record = (context: CrewContext, update: Partial<RuntimeActivity> & { id: string }) =>
  recordChatActivity(context, run.id, {
    kind: 'tool',
    status: 'completed',
    label: 'Reading profile',
    ...update,
  });
const checkpoint = (context: CrewContext) =>
  context.board.db
    .prepare('SELECT json FROM run_activity_checkpoints WHERE run_id=?')
    .get(run.id) as { json: string } | undefined;

afterEach(() => {
  for (const context of contexts.splice(0))
    if (boards.includes(context.board)) finishChatActivity(context, run.id);
  for (const board of boards.splice(0)) board.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
  vi.useRealTimers();
});

it('retains current activity and failure evidence after many successful steps', () => {
  const context = create();
  context.board.record('run', run, 'scout', 'Started');
  record(context, { id: 'active', status: 'running' });
  record(context, { id: 'failed', status: 'failed' });
  record(context, { id: 'interrupted', status: 'interrupted' });
  for (let i = 0; i < 120; i++) record(context, { id: `step-${i}` });
  const state = context.runActivities.get(run.id)!;
  expect(state.entries).toHaveLength(80);
  expect(state.truncated).toBe(true);
  expect(state.entries[0].id).toBe('active');
  expect(state.entries[1]).toMatchObject({ id: 'failed', status: 'failed' });
  expect(state.entries[2]).toMatchObject({ id: 'interrupted', status: 'interrupted' });
  expect(state.entries.at(-1)?.id).toBe('step-119');
  expect(state.entries.some((entry) => entry.id === 'step-0')).toBe(false);
  record(context, { id: 'active', status: 'completed' });
  expect(state.entries[0].status).toBe('completed');
  // No per-update events, just the initial run event.
  expect(context.board.events()).toHaveLength(1);
});

it('bounds even all-active activity and retains terminal updates for retained entries', () => {
  vi.useFakeTimers();
  const context = create();
  context.board.record('run', run, 'scout', 'Started');
  const observedStart = new Date().toISOString();
  record(context, { id: 'step-0', status: 'running' });
  vi.advanceTimersByTime(2000);
  for (let i = 1; i < 81; i++) record(context, { id: `step-${i}`, status: 'running' });
  record(context, { id: 'step-80', status: 'failed' });
  const state = context.runActivities.get(run.id)!;
  expect(state.entries).toHaveLength(80);
  expect(state.entries[0].id).toBe('step-1');
  expect(state.entries.at(-1)?.status).toBe('failed');
  record(context, { id: 'step-0', status: 'failed', text: 'Private tool payload' });
  expect(state.entries).toHaveLength(80);
  expect(state.entries.at(-1)).toMatchObject({
    id: 'step-0',
    status: 'failed',
    startedAt: observedStart,
    finishedAt: new Date().toISOString(),
  });
  expect(state.entries.at(-1)?.text).toBeUndefined();
});

it('checkpoints first activity then coalesces updates to one bounded write each ten seconds', () => {
  vi.useFakeTimers();
  const context = create();
  context.board.record('run', run, 'scout', 'Started');
  record(context, { id: 'first' });
  const first = checkpoint(context)!.json;
  for (let i = 0; i < 150; i++)
    record(context, { id: `update-${i}`, kind: 'commentary', text: 'Public progress.' });
  expect(checkpoint(context)!.json).toBe(first);
  vi.advanceTimersByTime(9999);
  expect(checkpoint(context)!.json).toBe(first);
  vi.advanceTimersByTime(1);
  const saved = JSON.parse(checkpoint(context)!.json);
  expect(saved.entries).toHaveLength(80);
  expect(saved.entries.at(-1).id).toBe('update-149');
  expect(context.board.events()).toHaveLength(1);
  finishChatActivity(context, run.id);
  expect(checkpoint(context)).toBeUndefined();
  expect(context.board.events()).toHaveLength(2);
  expect(vi.getTimerCount()).toBe(0);
});

it('recovers checkpoints after reopen and records interrupted public activity exactly once', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pitchcrew-activity-'));
  directories.push(directory);
  const filename = join(directory, 'board.db');
  const original = create(filename);
  original.board.record('run', run, 'scout', 'Started');
  record(original, {
    id: 'thinking',
    kind: 'reasoning',
    status: 'running',
    text: 'Private reasoning must never persist.',
  });
  expect(checkpoint(original)!.json).not.toContain('Private');
  original.board.close();
  boards.splice(boards.indexOf(original.board), 1);
  const recovered = create(filename);
  // Restoring advisory progress must never deserialize unrelated historical run snapshots.
  const list = vi.spyOn(recovered.board, 'list').mockImplementation(() => {
    throw new Error('Historical scan');
  });
  restoreActivityCheckpoints(recovered);
  list.mockRestore();
  expect(recovered.runActivities.get(run.id)?.entries[0]).not.toHaveProperty('text');
  recovered.board.record(
    'run',
    { ...run, status: 'failed', finishedAt: new Date().toISOString() },
    'system',
    'Recovered interrupted run',
  );
  finishChatActivity(recovered, run.id);
  const saved = recovered.board.get<Run>('run', run.id);
  expect(saved.status).toBe('failed');
  expect(saved.activity?.[0].status).toBe('interrupted');
  expect(checkpoint(recovered)).toBeUndefined();
  recovered.board.rebuild();
  expect(recovered.board.get<Run>('run', run.id).activity).toEqual(saved.activity);
});

it('ignores corrupt checkpoints and removes stale terminal or missing run rows', () => {
  const context = create();
  context.board.record('run', run, 'scout', 'Started');
  record(context, { id: 'public' });
  context.runActivities.clear();
  context.board.db
    .prepare('INSERT OR REPLACE INTO run_activity_checkpoints (run_id,json) VALUES (?,?)')
    .run(run.id, '{bad json');
  context.board.db
    .prepare('INSERT INTO run_activity_checkpoints (run_id,json) VALUES (?,?)')
    .run('missing-run', '{}');
  context.board.record(
    'run',
    { ...run, id: 'settled-run', status: 'completed', activity: [] },
    'scout',
    'Saved terminal activity',
  );
  context.board.db
    .prepare('INSERT INTO run_activity_checkpoints (run_id,json) VALUES (?,?)')
    .run('settled-run', '{}');
  expect(() => restoreActivityCheckpoints(context)).not.toThrow();
  expect(context.runActivities.size).toBe(0);
  expect(
    context.board.db.prepare('SELECT COUNT(*) AS count FROM run_activity_checkpoints').get(),
  ).toEqual({ count: 0 });
});

it('recovers the handoff if a crash followed the saved terminal outcome', () => {
  const context = create();
  context.board.record('run', run, 'scout', 'Started');
  record(context, { id: 'latest', status: 'completed' });
  context.board.record('run', { ...run, status: 'completed' }, 'scout', 'Completed');
  context.runActivities.clear();
  const terminal = restoreActivityCheckpoints(context);
  expect(terminal).toEqual([run.id]);
  for (const id of terminal) finishChatActivity(context, id);
  expect(context.board.get<Run>('run', run.id)).toMatchObject({
    status: 'completed',
    activity: [{ id: 'latest', status: 'completed' }],
  });
  expect(checkpoint(context)).toBeUndefined();
  expect(restoreActivityCheckpoints(context)).toEqual([]);
});
