import { roleCreate, type Role, type Skill } from '@pitchcrew/core';
import { afterEach, describe, expect, it } from 'vitest';
import { Board } from '../src/index.ts';
import { defaultRoles } from '../src/board/default-roles.ts';

const boards: Board[] = [];
function create() {
  const board = new Board(':memory:');
  boards.push(board);
  return board;
}
afterEach(() => boards.splice(0).forEach((board) => board.close()));
const ids = ['scout', 'writer', 'reviewer', 'submitter', 'tracker', 'documenter', 'pipeline-coach'];

describe('default crew', () => {
  it('seeds seven valid paused production roles without starting work or connecting accounts', () => {
    const board = create();
    board.seedRoles('claude-code', false);
    const roles = board.list<Role>('role');
    expect(roles.map((role) => role.id)).toEqual(ids);
    for (const role of roles) {
      expect(roleCreate.safeParse(role).success).toBe(true);
      expect(role).toMatchObject({ runtime: 'claude-code', enabled: false });
    }
    for (const role of roles.slice(3)) {
      expect(role.workflow).toBe('chat');
      expect(role.capabilities).toMatchObject({
        messageAgents: true,
        invokeAgents: false,
        manageWorkflow: false,
        github: false,
        gmail: false,
        drive: false,
        calendar: false,
        sheets: false,
      });
    }
    expect(roles[3].capabilities).toMatchObject({
      computerUse: true,
      assessForms: true,
      recordSubmissions: true,
      readApplications: true,
    });
    expect(roles[4].capabilities).toMatchObject({
      readApplications: true,
      trackApplications: true,
      manageRoutines: true,
      computerUse: false,
    });
    expect(roles[5].capabilities).toMatchObject({
      maintainProfile: true,
      manageRoutines: true,
      readApplications: false,
    });
    expect(roles[6].capabilities).toMatchObject({
      reviewPipeline: true,
      proposeCrewChanges: true,
      manageRoutines: true,
      computerUse: false,
    });
    expect(board.events().every((event) => event.kind === 'role')).toBe(true);
    expect(board.list('routine')).toEqual([]);
    expect(board.list('run')).toEqual([]);
  });

  it('backfills missing defaults without replacing customized, colliding or retired identities', () => {
    const board = create();
    const definitions = defaultRoles('demo', true);
    const saved = [
      ...definitions.slice(0, 3),
      {
        ...definitions[3],
        name: 'My helper',
        instructions: 'My instructions.',
        runtime: 'codex' as const,
        enabled: false,
      },
      { ...definitions[4], retiredAt: '2026-10-04T00:00:00.000Z', enabled: false },
    ];
    for (const role of saved) board.record('role', role, 'user', 'Existing role');
    board.seedRoles('claude-code', false);
    expect(board.list<Role>('role').slice(0, saved.length)).toEqual(saved);
    expect(board.list<Role>('role').map((role) => role.id)).toEqual(ids);
    const before = board.events();
    board.seedRoles('demo', true);
    expect(board.events()).toEqual(before);
    board.rebuild();
    board.seedRoles('claude-code', false);
    expect(board.events()).toEqual(before);
    expect(board.list<Role>('role').slice(0, saved.length)).toEqual(saved);
  });

  it('keeps development defaults enabled and respects the identity limit including retired roles', () => {
    const board = create();
    const template = defaultRoles('demo', true)[0];
    for (let index = 0; index < 48; index++)
      board.record(
        'role',
        { ...template, id: `fixture-${index}`, retiredAt: '2026-10-04T00:00:00.000Z' },
        'user',
        'Retired fixture',
      );
    board.seedRoles();
    expect(board.list<Role>('role')).toHaveLength(50);
    expect(board.list<Role>('role').slice(48)).toMatchObject([
      { id: 'scout', runtime: 'demo', enabled: true },
      { id: 'writer', runtime: 'demo', enabled: true },
    ]);
    const before = board.events(100);
    board.seedRoles();
    expect(board.events(100)).toEqual(before);
  });

  it('defers seeding if inherited shared skills exceed the creation budget', () => {
    const board = create();
    const skills: Skill[] = [0, 1].map((index) => ({
      id: `fixture-${index}`,
      name: 'Fictional skill',
      description: '',
      content: 'x'.repeat(30000),
      scope: 'all',
      roleIds: [],
      createdAt: '2026-10-04T00:00:00.000Z',
      updatedAt: '2026-10-04T00:00:00.000Z',
      deletedAt: null,
    }));
    for (const skill of skills) board.record('skill', skill, 'user', 'Shared fixture');
    board.seedRoles();
    expect(board.list('role')).toEqual([]);
    board.record(
      'skill',
      { ...skills[0], deletedAt: '2026-10-04T01:00:00.000Z' },
      'user',
      'Removed fixture',
    );
    board.seedRoles();
    expect(board.list('role')).toHaveLength(7);
  });

  it('rolls back every default if an event cannot be recorded', () => {
    const board = create();
    board.db.exec(`CREATE TRIGGER reject_tracker BEFORE INSERT ON events
      WHEN json_extract(NEW.json, '$.data.id') = 'tracker'
      BEGIN SELECT RAISE(ABORT, 'fixture failure'); END;`);
    expect(() => board.seedRoles()).toThrow('fixture failure');
    expect(board.list('role')).toEqual([]);
    expect(board.events()).toEqual([]);
  });
});
