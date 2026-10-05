import { type Role } from '@pitchcrew/core';
import { afterEach, describe, expect, it } from 'vitest';
import {
  Board,
  defaultInstructionHistory,
  defaultRoles,
  instructionRevision,
  instructionStatus,
  normalizeInstructions,
} from '../src/index.ts';

const boards: Board[] = [];
function create() {
  const board = new Board(':memory:');
  boards.push(board);
  board.seedRoles('claude-code', false);
  return board;
}
afterEach(() => boards.splice(0).forEach((board) => board.close()));

// The one-line defaults every workspace seeded before 2026-10-04.
const firstScout =
  'Evaluate the provided job against the profile. Explain the fit. Never invent jobs or qualifications.';
const firstWriter =
  'Write a tailored application packet. Every factual claim must appear verbatim in a profile source and include a source and quote. Never invent achievements.';
const firstReviewer =
  'Check every statement in the packet against the profile. Reject unverifiable claims and explain required changes. Review independently.';

function edit(board: Board, id: string, patch: Partial<Role>, actor = 'user') {
  const role = board.get<Role>('role', id);
  board.record('role', { ...role, ...patch }, actor, `Fixture edit of ${role.name}`);
}
function status(board: Board, id: string) {
  return board.defaultInstructionStatuses().find((item) => item.roleId === id);
}

describe('default instruction revisions', () => {
  it('records the current default of every seeded role as its latest revision', () => {
    for (const role of defaultRoles('claude-code', false)) {
      const history = defaultInstructionHistory[role.id];
      expect(history, `Add a revision history for ${role.id}.`).toBeDefined();
      const current = instructionRevision(role.instructions);
      expect(
        history.at(-1)?.revision,
        `The ${role.id} default changed. Append { revision: '${current}', date, summary } to default-instruction-history.ts.`,
      ).toBe(current);
      expect(history.at(-1)?.prerelease).toBeUndefined();
      for (const entry of history) {
        expect(entry.revision).toMatch(/^[a-f0-9]{16}$/);
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entry.summary.length).toBeGreaterThan(10);
        expect(entry.summary).not.toContain('—');
      }
      expect(new Set(history.map((entry) => entry.revision)).size).toBe(history.length);
    }
  });

  it('matches the original one-line defaults recovered from git history', () => {
    expect(defaultInstructionHistory.scout[0].revision).toBe(instructionRevision(firstScout));
    expect(defaultInstructionHistory.writer[0].revision).toBe(instructionRevision(firstWriter));
    expect(defaultInstructionHistory.reviewer[0].revision).toBe(instructionRevision(firstReviewer));
  });

  it('replays role events from versions 1 through 11 without rewriting their history', () => {
    const board = new Board(':memory:');
    boards.push(board);
    const role = defaultRoles('claude-code', false)[0];
    for (let version = 1; version <= 11; version++) {
      board.db.prepare('INSERT INTO events(json) VALUES (?)').run(
        JSON.stringify({
          id: 0,
          version,
          kind: 'role',
          entityId: role.id,
          actor: version === 1 ? 'system' : 'user',
          message: 'Fictional legacy settings',
          createdAt: '2026-10-01T00:00:00.000Z',
          data: {
            ...role,
            instructions:
              version === 1 ? firstScout : `${firstScout} Fictional preference ${version}.`,
          },
        }),
      );
    }
    const history = board.events();
    board.rebuild();
    expect(board.get<Role>('role', 'scout').defaultInstructionBase).toBeUndefined();
    expect(status(board, 'scout')).toMatchObject({
      state: 'customized',
      base: { instructions: firstScout },
    });
    expect(board.events()).toEqual(history);
  });

  it('ignores whitespace-only differences when computing revisions', () => {
    expect(normalizeInstructions('  One\n\n\ttwo   three \r\n')).toBe('One two three');
    expect(instructionRevision(`\n${firstScout.replace('. ', '.\n\n')}  `)).toBe(
      instructionRevision(firstScout),
    );
    expect(instructionRevision(`${firstScout} Extra.`)).not.toBe(instructionRevision(firstScout));
  });
});

describe('default instruction detection', () => {
  it('reports freshly seeded defaults as up to date', () => {
    const board = create();
    const statuses = board.defaultInstructionStatuses();
    expect(statuses.map((item) => item.roleId)).toEqual(
      defaultRoles('claude-code', false).map((role) => role.id),
    );
    for (const item of statuses) {
      expect(item).toMatchObject({ state: 'up_to_date', changes: [], toolDifferences: [] });
      expect(item.base).toBeUndefined();
    }
  });

  it('treats an unchanged earlier default as unedited and lists released changes since it', () => {
    const board = create();
    edit(board, 'scout', { instructions: firstScout }, 'system');
    const scout = status(board, 'scout')!;
    expect(scout.state).toBe('unedited');
    expect(scout.instructions).toBe(defaultRoles('claude-code', false)[0].instructions);
    expect(scout.revision).toBe(defaultInstructionHistory.scout.at(-1)!.revision);
    // The prerelease insights-only text is matched but not listed as a change.
    expect(scout.changes.map((change) => change.revision)).toEqual([
      '5351034367241fe7',
      '040296e5bc252a0d',
      '99ee31027dc9d202',
    ]);
    expect(scout.changes[0]).toEqual({
      revision: '5351034367241fe7',
      date: '2026-10-04',
      summary: expect.any(String),
    });
  });

  it('keeps whitespace-only edits in the same state', () => {
    const board = create();
    const current = board.get<Role>('role', 'writer').instructions;
    edit(board, 'writer', { instructions: `${current.replaceAll('\n\n', '\n')}\n\n` });
    expect(status(board, 'writer')?.state).toBe('up_to_date');
    edit(board, 'reviewer', { instructions: `  ${firstReviewer.replaceAll('. ', '.  ')}\n` });
    expect(status(board, 'reviewer')).toMatchObject({ state: 'unedited' });
    expect(status(board, 'reviewer')?.changes).toHaveLength(2);
  });

  it('finds the earlier default a customized role started from in its own history', () => {
    const board = create();
    edit(board, 'writer', { instructions: firstWriter }, 'system');
    edit(board, 'writer', { name: 'Fictional Writer' });
    edit(board, 'writer', { instructions: `${firstWriter} Keep a warm tone.` });
    edit(board, 'writer', { instructions: `${firstWriter} Keep a warm, direct tone.` });
    const writer = status(board, 'writer')!;
    expect(writer.state).toBe('customized');
    expect(writer.base).toEqual({
      revision: defaultInstructionHistory.writer[0].revision,
      instructions: firstWriter,
    });
    expect(writer.changes.map((change) => change.revision)).toEqual([
      'dc9c3471fb3730ec',
      '0ad8f0d05216e068',
      '5a080167cb370761',
    ]);
  });

  it('treats a customized current default as up to date', () => {
    const board = create();
    const current = board.get<Role>('role', 'tracker').instructions;
    edit(board, 'tracker', { instructions: `${current}\n\nCheck weekly.` });
    expect(status(board, 'tracker')?.state).toBe('up_to_date');
  });

  it('uses the latest known default in history after the user adopted one and edited again', () => {
    const board = create();
    edit(board, 'reviewer', { instructions: firstReviewer }, 'system');
    edit(board, 'reviewer', { instructions: `${firstReviewer} Old note.` });
    const current = defaultRoles('claude-code', false)[2].instructions;
    edit(board, 'reviewer', { instructions: current });
    edit(board, 'reviewer', { instructions: `${current} New note.` });
    expect(status(board, 'reviewer')?.state).toBe('up_to_date');
  });

  it('reports text with no known default as an unknown base', () => {
    const board = new Board(':memory:');
    boards.push(board);
    const custom: Role = {
      ...defaultRoles('claude-code', false)[3],
      instructions: 'Fictional submitter rules written before seeding.',
    };
    board.record('role', custom, 'system', 'Initialized legacy Submitter');
    board.seedRoles('claude-code', false);
    const submitter = status(board, 'submitter')!;
    expect(submitter.state).toBe('unknown_base');
    expect(submitter.base).toBeUndefined();
    expect(submitter.changes.map((change) => change.revision)).toEqual(['9dd6837b3291ebae']);
  });

  it('ignores user-created roles that reserved a default ID before seeding', () => {
    const board = new Board(':memory:');
    boards.push(board);
    board.record(
      'role',
      { ...defaultRoles('claude-code', false)[0], instructions: firstScout },
      'user',
      'Created Scout',
    );
    board.seedRoles('claude-code', false);
    expect(status(board, 'scout')).toBeUndefined();
  });

  it('uses the exact reviewed default as a customized base after another release', () => {
    const fallback = defaultRoles('claude-code', false)[1];
    const base = { revision: instructionRevision(firstWriter), instructions: firstWriter };
    const result = instructionStatus(
      {
        ...fallback,
        instructions: 'My completely rewritten instructions.',
        defaultInstructionBase: base,
      },
      fallback,
      () => [],
    );
    expect(result).toMatchObject({ state: 'customized', base });
    expect(result.changes.at(-1)?.revision).toBe(instructionRevision(fallback.instructions));
  });

  it('ignores retired default roles and custom roles', () => {
    const board = create();
    edit(board, 'scout', { instructions: firstScout, retiredAt: '2026-10-05T00:00:00.000Z' });
    board.record(
      'role',
      { ...defaultRoles('claude-code', false)[0], id: 'fictional-scout', instructions: firstScout },
      'user',
      'Created a custom role',
    );
    const ids = board.defaultInstructionStatuses().map((item) => item.roleId);
    expect(ids).not.toContain('scout');
    expect(ids).not.toContain('fictional-scout');
  });

  it('mentions tool differences without changing them', () => {
    const board = create();
    const scout = board.get<Role>('role', 'scout');
    edit(board, 'scout', {
      instructions: firstScout,
      capabilities: {
        messageAgents: true,
        invokeAgents: true,
        manageWorkflow: true,
        discoverJobs: true,
      },
    });
    expect(status(board, 'scout')?.toolDifferences).toEqual(['discoverJobs']);
    expect(board.get<Role>('role', 'scout').capabilities).toMatchObject({ discoverJobs: true });
    expect(scout.capabilities).toBeUndefined();
  });

  it('recomputes after each new board event', () => {
    const board = create();
    const first = board.defaultInstructionStatuses();
    expect(board.defaultInstructionStatuses()).toBe(first);
    edit(board, 'writer', { instructions: firstWriter }, 'system');
    expect(board.defaultInstructionStatuses()).not.toBe(first);
    expect(status(board, 'writer')?.state).toBe('unedited');
  });

  it('keeps detection pure for a single role', () => {
    const fallback = defaultRoles('claude-code', false)[1];
    let reads = 0;
    const saved = () => {
      reads += 1;
      return [firstWriter];
    };
    expect(
      instructionStatus({ ...fallback, instructions: firstWriter }, fallback, saved).state,
    ).toBe('unedited');
    expect(reads).toBe(0);
    expect(instructionStatus({ ...fallback, instructions: 'Mine.' }, fallback, saved).state).toBe(
      'customized',
    );
    expect(reads).toBe(1);
  });
});
