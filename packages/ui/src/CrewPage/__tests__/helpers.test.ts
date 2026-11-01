import { describe, expect, it } from 'vitest';
import type { Role, Run, Snapshot } from '@pitchcrew/core';
import {
  capabilityLine,
  crewRoster,
  crewStatus,
  crewSummary,
  elapsed,
  pendingProposals,
  runtimeLine,
  todaysRuns,
} from '../helpers.ts';

const role = (id: string, patch: Record<string, unknown> = {}) =>
  ({
    id,
    name: id[0].toUpperCase() + id.slice(1),
    description: 'Fictional responsibility.',
    instructions: '',
    runtime: 'codex',
    model: 'gpt-fictional',
    enabled: true,
    capabilities: {},
    ...patch,
  }) as unknown as Role;
const now = Date.parse('2026-11-01T12:00:00');
const run = (patch: Partial<Run>) =>
  ({
    id: 'run-1',
    roleId: 'writer',
    runtime: 'codex',
    status: 'completed',
    message: '',
    cardId: 'card-1',
    startedAt: '2026-11-01T09:00:00',
    finishedAt: '2026-11-01T09:10:00',
    threadId: 'thread-1',
    ...patch,
  }) as Run;
const base = {
  roles: [],
  runs: [],
  cards: [{ id: 'card-1', company: 'Northstar' }],
  conversations: [{ id: 'thread-2', title: 'Fictional planning' }],
  runtimes: [
    { id: 'codex', available: true, models: [{ value: 'gpt-fictional', label: 'GPT Fictional' }] },
  ],
  connectors: [],
  userInputs: [],
  proposals: [],
  skillProposals: [],
} as unknown as Snapshot;

describe('crew roster', () => {
  it('orders seeded roles by seat, then custom roles in saved order, without retired ones', () => {
    const roles = [
      role('helper'),
      role('documenter'),
      role('scout'),
      role('old', { retiredAt: '2026-10-01T00:00:00Z' }),
      role('other'),
      role('writer'),
    ];
    expect(crewRoster(roles).map((item) => item.id)).toEqual([
      'scout',
      'writer',
      'documenter',
      'helper',
      'other',
    ]);
  });
  it('counts agents with live work, ignoring review seat reservations', () => {
    const data = {
      ...base,
      roles: [role('scout'), role('writer')],
      runs: [
        run({ status: 'running', finishedAt: null }),
        run({ id: 'seat', roleId: 'scout', status: 'running', reviewSeatReservation: true }),
      ],
    } as Snapshot;
    expect(crewSummary(data)).toBe('2 agents, 1 working');
  });
});

describe('agent card facts', () => {
  it('names the strongest capability in one line', () => {
    expect(capabilityLine(role('scout', { capabilities: { computerUse: true } })).label).toBe(
      'Browser, asks first',
    );
    expect(capabilityLine(role('writer')).label).toBe('Drafts packets');
    expect(capabilityLine(role('tracker', { capabilities: { gmail: true } })).label).toBe(
      'Reads Gmail',
    );
    expect(capabilityLine(role('helper', { workflow: 'chat' })).label).toBe('Chat only');
  });
  it('uses the installed catalog label for the model', () => {
    expect(runtimeLine(role('writer'), base)).toBe('Codex · GPT Fictional');
    expect(runtimeLine(role('writer', { model: '' }), base)).toBe('Codex · CLI default');
  });
  it('formats elapsed work in minutes', () => {
    expect(elapsed('2026-11-01T11:59:40', now)).toBe('just started');
    expect(elapsed('2026-11-01T11:54:00', now)).toBe('6m');
    expect(elapsed('2026-11-01T10:30:00', now)).toBe('1h 30m');
  });
});

describe('crew status', () => {
  it('reports live work with its job, phase and exact run', () => {
    const live = run({ status: 'running', finishedAt: null, startedAt: '2026-11-01T11:54:00' });
    const status = crewStatus(role('writer'), { ...base, runs: [live] } as Snapshot, now);
    expect(status).toMatchObject({ kind: 'working', subject: 'Northstar', elapsed: '6m' });
    expect(status.kind === 'working' && status.run.id).toBe('run-1');
  });
  it('puts a pending question ahead of idle and pause states', () => {
    const data = {
      ...base,
      userInputs: [{ roleId: 'writer', status: 'pending', cardId: null, threadId: 'thread-2' }],
    } as unknown as Snapshot;
    expect(crewStatus(role('writer', { enabled: false }), data, now)).toEqual({
      kind: 'waiting',
      subject: 'Fictional planning',
      threadId: 'thread-2',
    });
  });
  it('says paused, unavailable or needs sign-in with the setup that fixes it', () => {
    const gmail = role('tracker', { enabled: false, capabilities: { gmail: true } });
    expect(crewStatus(gmail, base, now)).toEqual({
      kind: 'paused',
      cause: { text: 'Connect Google for Gmail.', section: 'accounts' },
    });
    expect(crewStatus(role('scout', { enabled: false }), base, now)).toEqual({ kind: 'paused' });
    const missing = { ...base, runtimes: [{ id: 'codex', available: false, models: [] }] };
    expect(crewStatus(role('scout'), missing as unknown as Snapshot, now).kind).toBe('unavailable');
    const signedOut = {
      ...base,
      runtimeMaintenance: {
        authentication: [
          { runtime: 'codex', model: 'gpt-fictional', result: { status: 'missing' } },
        ],
      },
    } as unknown as Snapshot;
    expect(crewStatus(role('scout'), signedOut, now).kind).toBe('signin');
  });
  it('gives one idle fact from the latest finished run', () => {
    const data = { ...base, runs: [run({ finishedAt: '2026-11-01T11:00:00' })] } as Snapshot;
    expect(crewStatus(role('writer'), data, now)).toMatchObject({ kind: 'idle' });
    expect(crewStatus(role('scout'), data, now)).toEqual({
      kind: 'idle',
      fact: 'Idle. No runs yet.',
    });
  });
});

describe('waiting on you', () => {
  it('lists only pending role and skill proposals with the chat that holds them', () => {
    const data = {
      ...base,
      proposals: [
        {
          id: 'p1',
          roleId: 'writer',
          sourceRoleId: 'pipeline-coach',
          reason: 'R',
          status: 'pending',
        },
        { id: 'p2', roleId: 'writer', reason: 'Done', status: 'applied' },
      ],
      skillProposals: [
        {
          id: 's1',
          roleId: 'reviewer',
          threadId: 'crew',
          reason: 'S',
          status: 'pending',
          skill: { name: 'Openings' },
        },
      ],
    } as unknown as Snapshot;
    expect(pendingProposals(data)).toEqual([
      {
        id: 'p1',
        kind: 'role',
        roleId: 'pipeline-coach',
        targetId: 'writer',
        reason: 'R',
        thread: 'writer',
      },
      {
        id: 's1',
        kind: 'skill',
        roleId: 'reviewer',
        targetId: 'Openings',
        reason: 'S',
        thread: 'crew',
      },
    ]);
  });
  it("lists today's runs oldest first with their subject", () => {
    const data = {
      ...base,
      runs: [
        run({ id: 'b', startedAt: '2026-11-01T10:00:00', cardId: null, threadId: 'thread-2' }),
        run({ id: 'a' }),
        run({ id: 'old', startedAt: '2026-10-31T10:00:00' }),
      ],
    } as Snapshot;
    expect(todaysRuns('writer', data, now).map((item) => [item.run.id, item.subject])).toEqual([
      ['a', 'Northstar'],
      ['b', 'Fictional planning'],
    ]);
  });
});
