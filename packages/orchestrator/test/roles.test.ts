import { adapters } from '@pitchcrew/adapters';
import {
  defaultCapabilities,
  roleIdSchema,
  type AgentTask,
  type Card,
  type ChatContext,
  type Role,
  type Run,
  type Routine,
  type Snapshot,
} from '@pitchcrew/core';
import { parseResult } from '../../adapters/src/process/results.ts';
import { promptFor } from '../../adapters/src/process/prompts.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, finish, setup } from './helpers/daemon.ts';

afterEach(cleanup);
const custom = {
  id: 'research-assistant',
  name: 'Research assistant',
  description: 'Research fictional opportunities.',
  runtime: 'demo',
  model: '',
  enabled: true,
  instructions: 'Use verified fictional sources.',
};
const schedule = {
  name: 'Future review',
  content: 'Review fictional opportunities.',
  roleId: custom.id,
  startAt: '2030-01-01T09:00:00Z',
  timezone: 'UTC',
  intervalMinutes: 60,
};

describe('stored configurable roles', () => {
  it('runs custom drafting and review seats through the existing packet and approval boundary', async () => {
    const { daemon, request } = await setup(14526);
    await daemon.service.saveProfile(
      'fictional.md',
      '# Fictional Candidate\n- Built fictional accessible interfaces.',
    );
    const writer = await daemon.service.createRole({
      ...custom,
      id: 'packet-assistant',
      workflow: 'writer',
    });
    const reviewer = await daemon.service.createRole({
      ...custom,
      id: 'evidence-assistant',
      workflow: 'reviewer',
    });
    const card = daemon.service.createCard({ company: 'Fictional Studio', title: 'Engineer' });
    daemon.service.moveCard(card.id, 'shortlisted');
    await finish(request, (await daemon.service.startRun(card.id, writer.id)).id);
    expect(daemon.service.board.get<Card>('card', card.id)).toMatchObject({
      state: 'in_review',
      packet: {
        claims: expect.arrayContaining([
          {
            claim: 'Built fictional accessible interfaces.',
            quote: 'Built fictional accessible interfaces.',
            source: 'fictional.md',
          },
        ]),
      },
    });
    await finish(request, (await daemon.service.startRun(card.id, reviewer.id)).id);
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('agreed');
    expect(daemon.service.board.list('approval')).toEqual([]);
    expect(() => daemon.service.moveCard(card.id, 'submitted')).toThrow();
  });

  it('reserves creation IDs synchronously before writing generated instructions', async () => {
    const { daemon } = await setup(14527);
    const outcomes = await Promise.allSettled([
      daemon.service.createRole(custom),
      daemon.service.createRole(custom),
    ]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'rejected']);
    expect(
      daemon.service.board.list<Role>('role').filter((role) => role.id === custom.id),
    ).toHaveLength(1);
  });

  it('creates a custom role alongside the default crew, snapshots skills and chat identity, and replays history', async () => {
    let turn: ChatContext | undefined;
    vi.spyOn(adapters.demo, 'chat').mockImplementation(async (context) => {
      turn = context;
      return { reply: 'Fictional research completed.' };
    });
    const { daemon, request } = await setup(14521);
    const created = await request<Role>('/roles', 'POST', custom);
    expect(created.response.status).toBe(201);
    expect(created.result).toMatchObject({
      id: custom.id,
      workflow: 'chat',
      retiredAt: null,
      capabilities: {
        messageAgents: false,
        invokeAgents: false,
        manageWorkflow: false,
        manageRoutines: false,
        github: false,
        gmail: false,
        computerUse: false,
      },
    });
    expect(daemon.service.board.list<Role>('role').map((role) => role.id)).toEqual([
      'scout',
      'writer',
      'reviewer',
      'submitter',
      'tracker',
      'documenter',
      'pipeline-coach',
      custom.id,
    ]);
    await request('/skills', 'POST', {
      name: 'Fictional research',
      content: 'Verify fictional evidence.',
      scope: 'roles',
      roleIds: [custom.id],
    });
    const { result: run } = await request<Run>(`/roles/${custom.id}/chat`, 'POST', {
      content: 'Research this opportunity.',
      threadId: custom.id,
    });
    await finish(request, run.id);
    expect(turn?.role.id).toBe(custom.id);
    expect(turn?.skills?.map((skill) => skill.name)).toEqual(['Fictional research']);
    const before = (await request<Snapshot>('/snapshot')).result;
    expect(
      before.messages.some(
        (message) => message.from === custom.id && message.threadId === custom.id,
      ),
    ).toBe(true);
    expect(before.events.every((event) => event.version === 9)).toBe(true);
    daemon.service.board.rebuild();
    const after = (await request<Snapshot>('/snapshot')).result;
    expect(after.roles).toEqual(before.roles);
    expect(after.messages).toEqual(before.messages);
    expect(after.skills).toEqual(before.skills);
  });

  it.each([
    '../escape',
    'Uppercase',
    'crew',
    'user',
    'system',
    'all',
    'shared',
    'con',
    'com1',
    'lpt9',
    'bad--id',
    'role/child',
    'x'.repeat(49),
  ])('rejects unsafe or reserved role ID %s', (id) => {
    expect(roleIdSchema.safeParse(id).success).toBe(false);
  });

  it('rejects identity reuse and unknown role actions without recording changes', async () => {
    const { daemon, request } = await setup(14522);
    expect((await request('/roles', 'POST', { ...custom, id: '../escape' })).response.status).toBe(
      400,
    );
    expect(
      (await request('/roles', 'POST', { ...custom, retiredAt: '2030-01-01' })).response.status,
    ).toBe(400);
    await request('/roles', 'POST', custom);
    const count = daemon.service.board.events(1000).length;
    expect((await request('/roles', 'POST', custom)).response.status).toBe(400);
    expect(
      (await request('/roles/missing/chat', 'POST', { content: 'Hello' })).response.status,
    ).toBe(400);
    expect((await request('/roles/missing', 'PUT', custom)).response.status).toBe(400);
    expect((await request('/roles/missing/retire', 'POST')).response.status).toBe(400);
    expect(
      (await request('/routines', 'POST', { ...schedule, roleId: 'missing' })).response.status,
    ).toBe(400);
    expect(
      (
        await request('/skills', 'POST', {
          name: 'Invalid assignment',
          content: 'Fictional',
          scope: 'roles',
          roleIds: ['missing'],
        })
      ).response.status,
    ).toBe(400);
    expect(daemon.service.board.events(1000)).toHaveLength(count);
  });

  it('keeps built-in workflow compatibility and custom workflow result identity separate', async () => {
    const { daemon, request } = await setup(14523);
    await daemon.service.saveProfile(
      'fictional.md',
      '# Fictional Candidate\n- Built fictional accessible interfaces.',
    );
    const role = await daemon.service.createRole({ ...custom, workflow: 'scout' });
    const card = daemon.service.createCard({
      company: 'Fictional Studio',
      title: 'Engineer',
      description: 'Build accessible interfaces.',
    });
    const workflow = await daemon.service.startRun(card.id, role.id);
    await finish(request, workflow.id);
    expect(daemon.service.board.get<Card>('card', card.id).fit).toBeGreaterThan(0);
    expect(daemon.service.board.get<Run>('run', workflow.id).roleId).toBe(custom.id);
    const context = {
      role,
      card,
      profile: [],
      skills: [],
      directory: '',
      mcp: { command: '', args: [], env: {} },
      signal: new AbortController().signal,
      onMessage: () => {},
    };
    expect(promptFor(context)).toContain(`You are Pitchcrew's ${custom.id}`);
    expect(promptFor(context)).toContain('"role":"scout"');
    expect(parseResult('{"role":"scout","fit":80,"reasons":["Fictional fit"]}', context).role).toBe(
      'scout',
    );
    expect(() => parseResult('{"role":"reviewer","passed":true,"feedback":[]}', context)).toThrow(
      'wrong role',
    );
    const generic = await daemon.service.createRole({ ...custom, id: 'generic-helper' });
    await expect(daemon.service.startRun(card.id, generic.id)).rejects.toThrow(
      'no application workflow seat',
    );
    const builtIn = await daemon.service.startRun(card.id, 'scout');
    await finish(request, builtIn.id);
    expect(daemon.service.board.get<Run>('run', builtIn.id).status).toBe('completed');
  });

  it('retains history, pauses routines and cancels queued work on retirement, while rejecting active edits', async () => {
    let complete!: (reply: { reply: string }) => void;
    vi.spyOn(adapters.demo, 'chat').mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const { daemon, request } = await setup(14524);
    const role = await daemon.service.createRole(custom);
    const routine = daemon.service.saveRoutine(schedule);
    const run = await daemon.service.sendChat(role.id, { content: 'Fictional question' });
    await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
    await expect(daemon.service.retireRole(role.id)).rejects.toThrow('active run');
    await expect(
      daemon.service.configureRole(role.id, { ...role, enabled: false }),
    ).rejects.toThrow('active run');
    complete({ reply: 'Fictional answer' });
    await finish(request, run.id);
    const source = daemon.service.board.get<Role>('role', 'scout');
    daemon.service.board.record(
      'run',
      { ...run, id: 'queued-parent', roleId: source.id },
      'system',
      'Fictional parent',
    );
    const task: AgentTask = {
      id: 'queued-child',
      parentRunId: 'queued-parent',
      rootRunId: 'queued-parent',
      roleId: role.id,
      cardId: null,
      mode: 'chat',
      trigger: 'invoke',
      threadId: 'crew',
      content: 'Fictional next task',
      status: 'queued',
      runId: null,
      error: '',
      createdAt: new Date().toISOString(),
    };
    daemon.service.board.record('task', task, 'scout', 'Fictional queue');
    const retired = await daemon.service.retireRole(role.id);
    expect(retired).toMatchObject({ enabled: false, retiredAt: expect.any(String) });
    expect(daemon.service.board.get<Routine>('routine', routine.id).enabled).toBe(false);
    expect(daemon.service.board.get<AgentTask>('task', task.id).status).toBe('cancelled');
    await expect(daemon.service.sendChat(role.id, { content: 'More' })).rejects.toThrow('retired');
    await expect(daemon.service.configureRole(role.id, { ...role })).rejects.toThrow('retired');
    await expect(daemon.service.createRole(custom)).rejects.toThrow('already exists');
    expect(() => daemon.service.saveRoutine(schedule)).toThrow('retired');
    daemon.service.board.rebuild();
    const snapshot = await daemon.service.snapshot();
    expect(snapshot.roles.find((item) => item.id === role.id)?.retiredAt).toBe(retired.retiredAt);
    expect(snapshot.messages.some((item) => item.content === 'Fictional answer')).toBe(true);
  });

  it('enforces source and target stored-role checks for every scoped gateway call and never grants approval', async () => {
    const { daemon } = await setup(14525);
    const source = await daemon.service.createRole({
      ...custom,
      capabilities: { ...defaultCapabilities },
    });
    const target = await daemon.service.createRole({ ...custom, id: 'other-helper' });
    daemon.service.board.record(
      'run',
      {
        id: 'fixture-run',
        roleId: source.id,
        cardId: null,
        runtime: 'demo',
        mode: 'chat',
        status: 'running',
        message: '',
        startedAt: '',
        finishedAt: null,
      },
      source.id,
      'Fictional capability',
    );
    const token = 'fixture-token';
    daemon.service.capabilities.set(token, {
      runId: 'fixture-run',
      roleId: source.id,
      cardId: null,
    });
    expect(await daemon.service.agentCall(token, 'roles', {})).toMatchObject({
      roles: expect.arrayContaining([
        {
          id: source.id,
          name: source.name,
          description: source.description,
          enabled: true,
          workflow: 'chat',
        },
      ]),
    });
    await expect(
      daemon.service.agentCall(token, 'invoke', {
        roleId: 'missing',
        mode: 'chat',
        content: 'Hello',
      }),
    ).rejects.toThrow('not found');
    await daemon.service.retireRole(target.id);
    await expect(
      daemon.service.agentCall(token, 'message', { roleId: target.id, content: 'Hello' }),
    ).rejects.toThrow('retired');
    await expect(
      daemon.service.agentCall(token, 'propose_skill', {
        reason: 'Fictional',
        suggestion: {
          kind: 'custom',
          skill: {
            name: 'Fictional skill',
            content: 'Fictional',
            scope: 'roles',
            roleIds: [target.id],
          },
        },
      }),
    ).rejects.toThrow('retired');
    await expect(daemon.service.agentCall(token, 'approve', {})).rejects.toThrow('not allowed');
    daemon.service.board.record(
      'role',
      { ...source, enabled: false },
      'user',
      'Fixture paused role',
    );
    await expect(daemon.service.agentCall(token, 'profile', {})).rejects.toThrow('paused');
    daemon.service.board.record(
      'role',
      { ...source, enabled: false, retiredAt: new Date().toISOString() },
      'user',
      'Fixture retired role',
    );
    await expect(daemon.service.agentCall(token, 'roles', {})).rejects.toThrow('retired');
    daemon.service.capabilities.set(token, {
      runId: 'fixture-run',
      roleId: 'missing',
      cardId: null,
    });
    await expect(daemon.service.agentCall(token, 'messages', {})).rejects.toThrow('not found');
    expect(daemon.service.board.list('approval')).toEqual([]);
  });
});
