import { Board } from '@pitchcrew/board';
import {
  browserActionSchema,
  currentEventVersion,
  decodeEvent,
  type BrowserAction,
  type ComputerApproval,
} from '@pitchcrew/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { ComputerManager } from '../src/computer.ts';

it.each([
  [
    'page.goto: Timeout 20000ms exceeded.\nCall log:\n\u001b[2m  - navigating to "https://example.com/apply"\u001b[22m\n',
    'page.goto: Timeout 20000ms exceeded.\nCall log:\n  - navigating to "https://example.com/apply"\n',
  ],
  [
    'The page changed. Inspect it and request a new approval.',
    'The page changed. Inspect it and request a new approval.',
  ],
])(
  'saves plain execution diagnostics while retaining the user decision and single-use gate: %s',
  async (message, plain) => {
    const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-browser-failure-'));
    const board = new Board(join(directory, 'board.db'));
    const failure = new Error(message);
    const perform = vi.fn(async () => {
      throw failure;
    });
    const manager = new ComputerManager(board, directory, async () => ({
      snapshot: async () => ({
        url: 'about:blank',
        title: '',
        text: '',
        screenshot: '',
        digest: 'stable-page',
      }),
      perform,
      close: async () => {},
    }));
    const scope = { runId: 'failed-navigation', roleId: 'writer', cardId: null };
    try {
      const requested = await manager.request(
        scope,
        { kind: 'navigate', url: 'https://example.com/apply' },
        'Open the application page',
      );
      const approved = manager.decide(requested.id, true);
      await expect(
        manager.execute(scope.runId, requested.id, new AbortController().signal, () => {}, 0),
      ).rejects.toMatchObject({ message: plain, name: failure.name });
      const saved = board.get<ComputerApproval>('computer_approval', requested.id);
      expect(saved).toMatchObject({
        status: 'failed',
        error: plain,
        decidedAt: approved.decidedAt,
        digest: approved.digest,
      });
      expect(approved.status).toBe('approved');
      board.rebuild();
      expect(board.get<ComputerApproval>('computer_approval', requested.id)).toEqual(saved);
      await expect(
        manager.execute(scope.runId, requested.id, new AbortController().signal, () => {}, 0),
      ).rejects.toThrow('Browser action is failed.');
      expect(perform).toHaveBeenCalledTimes(1);
    } finally {
      await manager.close();
      board.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

it('retains exact scroll, hover and drag approvals in version 29 while replaying older events', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-browser-actions-'));
  const board = new Board(join(directory, 'board.db'));
  const perform = vi.fn(async () => {});
  const manager = new ComputerManager(board, directory, async () => ({
    snapshot: async () => ({
      url: 'https://example.com',
      title: 'Fixture',
      text: 'Fixture',
      screenshot: '',
      digest: 'stable-page',
    }),
    perform,
    close: async () => {},
  }));
  const scope = { runId: 'actions', roleId: 'writer', cardId: null };
  const actions: BrowserAction[] = [
    { kind: 'hover', selector: '#menu' },
    { kind: 'scroll', selector: '#content', deltaX: 0, deltaY: 600 },
    { kind: 'drag', selector: '#source', targetSelector: '#destination' },
  ];
  try {
    for (const action of actions) {
      expect(browserActionSchema.parse(action)).toEqual(action);
      const approval = await manager.request(scope, action, 'Inspect fictional controls');
      expect(approval.status).toBe('pending');
      manager.decide(approval.id, true);
      await manager.execute(scope.runId, approval.id, new AbortController().signal, () => {}, 0);
      expect(perform).toHaveBeenLastCalledWith(action, undefined);
    }
    expect(currentEventVersion).toBe(33);
    expect(board.events().every((event) => event.version === currentEventVersion)).toBe(true);
    for (const version of [26, 27, 28])
      expect(decodeEvent(JSON.stringify({ version })).version).toBe(version);
    board.rebuild();
    expect(board.list('computer_approval')).toHaveLength(3);
    expect(() =>
      browserActionSchema.parse({ kind: 'scroll', selector: 'body', deltaY: 100000 }),
    ).toThrow();
  } finally {
    await manager.close();
    board.close();
    await rm(directory, { recursive: true, force: true });
  }
});
