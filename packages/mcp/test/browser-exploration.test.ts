import { Board } from '@pitchcrew/board';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ComputerManager } from '../src/computer.ts';
import { explorationNavigation } from '../src/computer/form-policy.ts';

it('keeps browsing separate from form preparation and rechecks revocation before execution', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-exploration-'));
  const board = new Board(join(directory, 'board.db'));
  const manager = new ComputerManager(board, directory, async () => ({
    snapshot: async () => ({
      url: 'https://example.com',
      title: '',
      text: '',
      screenshot: '',
      digest: 'same',
    }),
    exploration: async (action) => ['hover', 'scroll'].includes(action.kind),
    perform: async () => {},
    close: async () => {},
  }));
  const scope = { runId: 'exploration', roleId: 'writer', cardId: null };
  try {
    manager.bindBrowser({ ...scope, mode: 'autonomous', taskId: 'task' });
    manager.allowSite('writer', 'task', 'https://example.com', true, undefined, true);
    const request = (action: unknown) => manager.request(scope, action, 'Read fictional page');
    const scroll = await request({ kind: 'scroll', selector: 'body', deltaY: 100 });
    expect(scroll.automatic).toBe(true);
    manager.allowSite('writer', 'task', 'https://example.com', false);
    await expect(
      manager.execute(scope.runId, scroll.id, new AbortController().signal, () => {}, 0),
    ).rejects.toThrow('permission changed');
    manager.allowSite('writer', 'task', 'https://example.com', true, undefined, true);
    const field = await request({ kind: 'fill', selector: '#answer', value: 'Answer' });
    expect(field.status).toBe('pending');
    manager.decide(field.id, false);
    const navigation = await request({
      kind: 'navigate',
      url: 'https://example.com/search?q=engineering',
    });
    expect(navigation.automatic).toBe(true);
    expect(explorationNavigation('https://example.com/submit')).toBe(false);
    expect(explorationNavigation('https://example.com/?action=delete')).toBe(false);
    expect(explorationNavigation('http://example.com')).toBe(false);
  } finally {
    await manager.close();
    board.close();
    await rm(directory, { recursive: true, force: true });
  }
});
