import { Board } from '@pitchcrew/board';
import type { Role, Run } from '@pitchcrew/core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { workspaceRuns } from '../src/crew/workspace-projection.ts';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
const run = (id: string, status: Run['status'] = 'completed'): Run => ({
  id,
  cardId: null,
  roleId: 'scout',
  runtime: 'claude-code',
  status,
  message: `Fictional ${id}`,
  startedAt: '2026-11-10T00:00:00.000Z',
  finishedAt: null,
  configuration: {
    role: { model: 'fictional-model', instructions: 'Frozen instructions' } as Role,
    revision: 'r',
    skills: [],
    skillsRevision: 's',
  },
});

it('reuses compact runs and refetches only runs named by newer events', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pitchcrew-workspace-runs-'));
  directories.push(directory);
  const filename = join(directory, 'pitchcrew.db');
  const board = new Board(filename);
  const other = new Board(filename);
  try {
    board.record('run', run('a', 'running'), 'system', 'Fixture');
    board.record('run', run('b'), 'system', 'Fixture');
    const first = workspaceRuns(board);
    expect(first.map((r) => r.id)).toEqual(['b', 'a']);
    expect(first[0]).toMatchObject({ model: 'fictional-model' });
    expect(first[0].configuration).toBeUndefined();
    // Callers own their copies.
    first[0].message = 'changed by caller';
    expect(workspaceRuns(board)[0].message).toBe('Fictional b');

    board.record('run', run('a', 'failed'), 'system', 'Fixture update');
    board.record('run', run('c'), 'system', 'Fixture');
    expect(() =>
      board.db.transaction(() => {
        board.record('run', run('rolled-back'), 'system', 'Fixture');
        expect(workspaceRuns(board).some((r) => r.id === 'rolled-back')).toBe(true);
        throw new Error('rollback');
      })(),
    ).toThrow('rollback');
    other.record('run', run('external'), 'system', 'Another connection');
    const updated = workspaceRuns(board);
    expect(updated.map((r) => r.id)).toEqual(['external', 'c', 'b', 'a']);
    expect(updated.find((r) => r.id === 'a')?.status).toBe('failed');

    // A row change without an event is not re-read, proving warm snapshots skip the full scan.
    board.db
      .prepare("UPDATE entities SET json=json_set(json,'$.message','unread') WHERE id='b'")
      .run();
    expect(workspaceRuns(board).find((r) => r.id === 'b')?.message).toBe('Fictional b');
  } finally {
    other.close();
    board.close();
  }
});
