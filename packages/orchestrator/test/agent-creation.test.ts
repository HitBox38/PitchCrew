import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Role, Routine, Skill, Snapshot } from '@pitchcrew/core';
import type { CrewContext } from '../src/crew/types.ts';
import { cleanup, setup } from './helpers/daemon.ts';
import { directorySkill } from './helpers/daemon.ts';

afterEach(cleanup);
const agent = {
  id: 'research-partner',
  name: 'Research partner',
  description: 'Investigate fictional opportunities.',
  runtime: 'demo',
  model: '',
  enabled: true,
  instructions: 'Report verified evidence.',
};
const routine = {
  name: 'Weekly research',
  roleId: agent.id,
  content: 'Review fictional sources.',
  startAt: '2030-01-01T09:00:00Z',
  timezone: 'UTC',
  intervalMinutes: 10080,
  enabled: false,
};
const input = (skill: Skill) => ({
  name: skill.name,
  description: skill.description,
  content: skill.content,
  scope: skill.scope,
  roleIds: skill.roleIds,
});
const reference = (skill: Skill) => ({ id: skill.id, updatedAt: skill.updatedAt });

describe('guided agent setup', () => {
  it('commits a generic role, preserves other skill assignments and provenance, saves a paused routine, and replays all entities', async () => {
    const { daemon, request } = await setup(14901);
    const skill = daemon.service.saveSkill({
      source: directorySkill.source,
      name: 'Evidence',
      content: 'Use fictional evidence.',
      scope: 'roles',
      roleIds: ['scout'],
    });
    await daemon.service.retireRole('scout');
    const shared = daemon.service.saveSkill({
      name: 'Shared',
      content: 'Be concise.',
      scope: 'all',
      roleIds: [],
    });
    const result = await request<Role>('/roles', 'POST', {
      ...agent,
      skills: [reference(skill)],
      routine,
    });
    expect(result.response.status).toBe(201);
    expect(result.result).toMatchObject({
      workflow: 'chat',
      capabilities: {
        github: false,
        invokeAgents: false,
        computerUse: false,
        reviewPipeline: false,
      },
    });
    expect(result.result).not.toHaveProperty('skills');
    expect(result.result).not.toHaveProperty('routine');
    expect(daemon.service.board.get<Skill>('skill', skill.id)).toMatchObject({
      ...input(skill),
      roleIds: ['scout', agent.id],
      source: directorySkill.source,
    });
    expect(daemon.service.board.get<Skill>('skill', shared.id)).toEqual(shared);
    expect(daemon.service.board.list<Routine>('routine')).toMatchObject([
      {
        ...routine,
        startAt: new Date(routine.startAt).toISOString(),
        runCount: 0,
        createdBy: 'user',
        updatedBy: 'user',
      },
    ]);
    expect(daemon.service.board.list('run')).toHaveLength(0);
    expect(daemon.service.board.list('approval')).toHaveLength(0);
    const before = (await request<Snapshot>('/snapshot')).result;
    daemon.service.board.rebuild();
    const after = (await request<Snapshot>('/snapshot')).result;
    expect(after.roles).toEqual(before.roles);
    expect(after.skills).toEqual(before.skills);
    expect(after.routines).toEqual(before.routines);
    expect(before.events.every((event) => event.version === 9)).toBe(true);
  });

  it.each([
    { ...routine, roleId: 'writer' },
    { ...routine, timezone: 'Invalid/Zone' },
    { ...routine, intervalMinutes: null, cron: 'invalid' },
    { ...routine, intervalMinutes: null, cron: '0 9 * * 1', endsAt: '2030-01-01T10:00:00Z' },
    { ...routine, cardId: '00000000-0000-4000-8000-000000000001' },
  ])('rejects an invalid schedule without any role or skill events', async (invalid) => {
    const { daemon, request } = await setup(14902);
    const skill = daemon.service.saveSkill({
      name: 'Evidence',
      content: 'Fictional.',
      scope: 'roles',
      roleIds: ['scout'],
    });
    const before = daemon.service.board.events(1000);
    expect(
      (await request('/roles', 'POST', { ...agent, skills: [reference(skill)], routine: invalid }))
        .response.status,
    ).toBe(400);
    expect(daemon.service.board.events(1000)).toEqual(before);
    expect(daemon.service.board.get<Skill>('skill', skill.id)).toEqual(skill);
  });

  it('rejects stale, deleted, duplicate and oversized skills before creating a role', async () => {
    const { daemon, request } = await setup(14903);
    const first = daemon.service.saveSkill({
      name: 'Long instructions',
      content: 'A'.repeat(40000),
      scope: 'roles',
      roleIds: ['scout'],
    });
    const second = daemon.service.saveSkill({
      name: 'Other instructions',
      content: 'B'.repeat(40000),
      scope: 'roles',
      roleIds: ['writer'],
    });
    const before = daemon.service.board.events(1000);
    for (const skills of [
      [reference(first), reference(second)],
      [reference(first), reference(first)],
      [{ ...reference(first), updatedAt: '2000-01-01T00:00:00Z' }],
    ])
      expect((await request('/roles', 'POST', { ...agent, skills })).response.status).toBe(400);
    expect(daemon.service.board.events(1000)).toEqual(before);
    daemon.service.deleteSkill(first.id);
    const after = daemon.service.board.events(1000);
    expect(
      (await request('/roles', 'POST', { ...agent, skills: [reference(first)] })).response.status,
    ).toBe(400);
    expect(daemon.service.board.events(1000)).toEqual(after);
  });

  it('rechecks skill versions after asynchronous instruction writes and permits retry with the reviewed version', async () => {
    const { daemon } = await setup(14904);
    const context = (daemon.service as unknown as { context: CrewContext }).context;
    const skill = daemon.service.saveSkill({
      name: 'Evidence',
      content: 'Fictional.',
      scope: 'roles',
      roleIds: ['scout'],
    });
    vi.spyOn(context, 'writeRole').mockImplementationOnce(async () => {
      daemon.service.board.record(
        'skill',
        { ...skill, content: 'Changed instructions.', updatedAt: '2030-01-01T00:00:00Z' },
        'user',
        'Fictional concurrent edit',
      );
    });
    await expect(
      daemon.service.createRole({ ...agent, skills: [reference(skill)], routine }),
    ).rejects.toThrow('selected skill changed');
    expect(daemon.service.board.list<Role>('role').some((role) => role.id === agent.id)).toBe(
      false,
    );
    expect(daemon.service.board.list('routine')).toHaveLength(0);
    const current = daemon.service.board.get<Skill>('skill', skill.id);
    await daemon.service.createRole({ ...agent, skills: [reference(current)], routine });
    expect(daemon.service.board.get<Skill>('skill', skill.id).roleIds).toContain(agent.id);
  });

  it('rolls back the complete setup if the last event fails', async () => {
    const { daemon } = await setup(14905);
    const skill = daemon.service.saveSkill({
      name: 'Evidence',
      content: 'Fictional.',
      scope: 'roles',
      roleIds: ['scout'],
    });
    const before = daemon.service.board.events(1000);
    const record = daemon.service.board.record.bind(daemon.service.board);
    vi.spyOn(daemon.service.board, 'record').mockImplementation((kind, data, actor, message) => {
      if (kind === 'routine') throw new Error('Fictional write failure');
      return record(kind, data, actor, message);
    });
    await expect(
      daemon.service.createRole({ ...agent, skills: [reference(skill)], routine }),
    ).rejects.toThrow('write failure');
    expect(daemon.service.board.events(1000)).toEqual(before);
    expect(daemon.service.board.get<Skill>('skill', skill.id)).toEqual(skill);
    expect(daemon.service.board.list<Role>('role').some((role) => role.id === agent.id)).toBe(
      false,
    );
    expect(daemon.service.board.list('routine')).toHaveLength(0);
  });
});
