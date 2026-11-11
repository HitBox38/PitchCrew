import { LifecycleError, type Approval, type ChatRequest, type Run } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { Board } from '../src/index.ts';

const boards: Board[] = [];
const open = () => {
  const board = new Board(':memory:');
  boards.push(board);
  return board;
};
afterEach(() => {
  vi.restoreAllMocks();
  process.env.PITCHCREW_LIFECYCLES = 'enforce';
  for (const board of boards.splice(0)) board.close();
});

const run = (status: Run['status']) => ({ id: 'run-1', status }) as Run;
const request = (...statuses: ChatRequest['deliveries'][number]['status'][]) =>
  ({
    id: 'request-1',
    deliveries: statuses.map((status, index) => ({
      roleId: `agent-${index}`,
      status,
      runId: null,
      error: '',
    })),
  }) as ChatRequest;

it('refuses an undeclared status move without appending an event', () => {
  const board = open();
  board.record('run', run('running'), 'system', 'Started');
  board.record('run', run('completed'), 'system', 'Finished');
  const saved = board.events(100).length;
  expect(() => board.record('run', run('running'), 'system', 'Restarted')).toThrow(LifecycleError);
  expect(() => board.record('run', run('running'), 'system', 'Restarted')).toThrow(
    'Run cannot go from completed to running. completed is final.',
  );
  expect(board.events(100)).toHaveLength(saved);
  expect(board.get<Run>('run', 'run-1').status).toBe('completed');
});

it('allows creation in any status and writes that keep the status', () => {
  const board = open();
  // Imports, fixtures and recovery create entities part-way through their life.
  board.record('approval', { id: 'approval-1', status: 'consumed' } as Approval, 'user', 'Made');
  board.record(
    'approval',
    { id: 'approval-1', status: 'consumed', exportDirectory: '/fictional' } as Approval,
    'user',
    'Exported',
  );
  expect(board.get<Approval>('approval', 'approval-1').exportDirectory).toBe('/fictional');
  expect(() =>
    board.record('approval', { id: 'approval-1', status: 'approved' } as Approval, 'user', 'Reuse'),
  ).toThrow('Packet approval cannot go from consumed to approved.');
});

it('checks each recipient of a request on its own', () => {
  const board = open();
  board.record('chat_request', request('queued', 'completed'), 'user', 'Sent');
  board.record('chat_request', request('running', 'completed'), 'system', 'Started');
  expect(() =>
    board.record('chat_request', request('running', 'queued'), 'system', 'Requeued'),
  ).toThrow('Message delivery cannot go from completed to queued. completed is final.');
  // A recipient added by an edit has no earlier status to move from.
  board.record('chat_request', request('running', 'completed', 'queued'), 'user', 'Edited');
  expect(board.get<ChatRequest>('chat_request', 'request-1').deliveries).toHaveLength(3);
});

it('saves and reports an undeclared move once outside tests', () => {
  process.env.PITCHCREW_LIFECYCLES = 'report';
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const board = open();
  for (const id of ['run-1', 'run-2']) {
    board.record('run', { ...run('completed'), id }, 'system', 'Finished');
    board.record('run', { ...run('running'), id }, 'system', 'Restarted');
    expect(board.get<Run>('run', id).status).toBe('running');
  }
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith(
    'Pitchcrew lifecycle: Run cannot go from completed to running. completed is final.',
  );
});

it('replays history that predates a table without checking it', () => {
  process.env.PITCHCREW_LIFECYCLES = 'report';
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const lenient = open();
  lenient.record('run', run('completed'), 'system', 'Finished');
  lenient.record('run', run('running'), 'system', 'Restarted');
  process.env.PITCHCREW_LIFECYCLES = 'enforce';
  lenient.rebuild();
  expect(lenient.get<Run>('run', 'run-1').status).toBe('running');
});

it('lets a fixture switch the check off for one deliberate rewind', () => {
  const board = open();
  expect(board.lifecycleMode).toBe('enforce');
  board.record('run', run('completed'), 'system', 'Finished');
  board.lifecycleMode = 'off';
  board.record('run', run('running'), 'system', 'Fixture rewind');
  board.lifecycleMode = 'enforce';
  expect(() => board.record('run', run('waiting'), 'system', 'Asked')).not.toThrow();
  expect(() => board.record('run', run('running'), 'system', 'Resumed')).toThrow(
    'Run cannot go from waiting to running.',
  );
});
