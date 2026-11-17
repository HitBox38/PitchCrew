import { expect, it, vi } from 'vitest';
import type { Run } from '@pitchcrew/core';
import type { CardDetailsModel } from '../types.ts';
import { jobDock } from '../dock.ts';
import { jobNextAction } from '../next-action.ts';

const model = (patch: Partial<CardDetailsModel> = {}): CardDetailsModel =>
  ({
    card: { id: 'job', state: 'shortlisted', owner: null, packet: null, fit: 82 },
    data: {
      roles: [{ id: 'writer', name: 'Writer', enabled: true, runtime: 'demo' }],
      runs: [],
      runtimes: [{ id: 'demo', available: true, applicationIsolation: true }],
      profile: [{ content: 'Fictional experience' }],
      approvals: [],
      userInputs: [],
    },
    brief: {
      loaded: { context: {} },
      confirmed: true,
      draft: { requirements: [] },
      roleId: 'writer',
      startDraft: vi.fn(),
    },
    work: { pending: undefined, starting: false, spinning: false },
    agents: [],
    exported: false,
    runRole: 'writer',
    act: vi.fn(),
    openApplication: vi.fn(),
    setTab: vi.fn(),
    openChat: vi.fn(),
    ...patch,
  }) as unknown as CardDetailsModel;
const dock = (value: CardDetailsModel) => jobDock(value, jobNextAction(value));

it('raises the dock for the user’s move and names the launching agent once', () => {
  expect(dock(model())).toMatchObject({
    material: 'raised',
    line: 'Ready to draft your application',
    detail: 'Writer · Demo · No AI calls',
  });
});

it('recesses while an agent works and carries its public activity, not four status labels', () => {
  const run = {
    id: 'run',
    roleId: 'writer',
    status: 'running',
    message: 'Drafting',
    activity: [{ id: 'c', kind: 'commentary', label: 'Update', text: 'Matching the posting.' }],
  } as Run;
  expect(dock(model({ run, agents: [{ run, name: 'Writer' }] }))).toMatchObject({
    material: 'rest',
    tone: 'plum',
    live: true,
    line: 'Writer is working',
    detail: 'Matching the posting.',
  });
});

it('names a deep review in the dock rather than one agent turn', () => {
  const run = { id: 'deep', roleId: 'writer', status: 'running', deepReviewId: 'report' } as Run;
  expect(dock(model({ run, agents: [{ run, name: 'Writer' }] })).line).toBe(
    'Deep review · Writer is working',
  );
});

it('quotes a waiting question in ochre and the captured page for an uncertain submission', () => {
  const run = { id: 'ask', roleId: 'writer', status: 'waiting', threadId: 'chat' } as Run;
  const base = model({ agents: [{ run, name: 'Writer' }] });
  const asking = {
    ...base,
    data: {
      ...base.data,
      userInputs: [{ runId: 'ask', status: 'pending', question: 'Which portfolio link?' }],
    },
  } as unknown as CardDetailsModel;
  expect(dock(asking)).toMatchObject({
    material: 'ask',
    tone: 'ochre',
    line: 'Writer asks: “Which portfolio link?”',
  });
  const card = {
    ...base.card,
    submissionAttempts: [{ id: 'a', status: 'uncertain', evidence: 'Reference KITE-2291.' }],
  } as unknown as CardDetailsModel['card'];
  expect(dock(model({ card }))).toMatchObject({
    material: 'ask',
    line: 'Did the application go through?',
    detail: 'The page said: “Reference KITE-2291.”',
  });
});

it('keeps a failed run as evidence beside the next valid action', () => {
  const failed = { id: 'old', status: 'failed', message: 'Rate limit reached.' } as Run;
  const value = model({ failed });
  expect(jobNextAction(value).label).toBe('Draft application');
  expect(dock(value)).toMatchObject({
    material: 'raised',
    line: 'Ready to draft your application',
    failure: 'Rate limit reached.',
  });
});

it('asks how it went after applying and says recording never contacts the employer', () => {
  const card = { ...model().card, state: 'screening' } as CardDetailsModel['card'];
  const result = dock(model({ card }));
  expect(result).toMatchObject({ material: 'raised', line: 'How did screening go?' });
  expect(result.detail).toContain('The employer isn’t contacted.');
  const closed = { ...card, state: 'rejected' } as CardDetailsModel['card'];
  expect(dock(model({ card: closed }))).toMatchObject({
    material: 'rest',
    line: 'Closed as rejected',
  });
  // An offer's only change is withdrawing: the dock rests and points to Activity instead.
  const offer = { ...card, state: 'offer' } as CardDetailsModel['card'];
  expect(dock(model({ card: offer }))).toMatchObject({
    material: 'rest',
    line: 'You have an offer',
    detail: 'If you turn it down, mark it withdrawn in Activity. The employer isn’t contacted.',
  });
});

it('promises a continuation only for a question and never calls stalled or blocked work ready', () => {
  const run = { id: 'wait', roleId: 'writer', status: 'waiting', threadId: 'chat' } as Run;
  expect(dock(model({ agents: [{ run, name: 'Writer' }] }))).toMatchObject({
    line: 'Writer is waiting for you',
    detail: 'Open the job chat to see what it needs.',
  });
  const drafting = { ...model().card, state: 'drafting' } as CardDetailsModel['card'];
  expect(dock(model({ card: drafting }))).toMatchObject({
    material: 'rest',
    line: 'No agent is drafting right now',
  });
  const base = model();
  const blocked = { ...base, data: { ...base.data, profile: [] } } as unknown as CardDetailsModel;
  expect(dock(blocked)).toMatchObject({
    material: 'raised',
    line: 'Finish setup to continue',
    detail: 'Add your profile notes before starting the crew.',
  });
});

it('keeps a running agent first while another waits with a question, without hiding it', () => {
  const working = { id: 'work', roleId: 'writer', status: 'running' } as Run;
  const asking = { id: 'ask', roleId: 'reviewer', status: 'waiting', threadId: 'chat' } as Run;
  const base = model({
    run: working,
    agents: [
      { run: working, name: 'Writer' },
      { run: asking, name: 'Reviewer' },
    ],
  });
  const value = {
    ...base,
    data: {
      ...base.data,
      userInputs: [{ runId: 'ask', status: 'pending', question: 'Which evidence?' }],
    },
  } as unknown as CardDetailsModel;
  // The live run owns the dock; the question stays on the Reviewer's header chip and in chat.
  expect(jobNextAction(value).kind).toBe('running');
  expect(dock(value)).toMatchObject({ material: 'rest', line: 'Writer is working' });
});

it('tints the dock ochre when the step’s own decision waits, by the header’s rule', () => {
  const card = {
    id: 'job',
    state: 'shortlisted',
    owner: null,
    packet: null,
    fit: 82,
    applicationContext: {
      revision: 'r2',
      confirmedRevision: 'r1',
      confirmedAt: 'x',
      createdAt: 'x',
    },
    updatedAt: 'x',
  } as unknown as CardDetailsModel['card'];
  const base = model({ card });
  const value = {
    ...base,
    data: { ...base.data, cards: [card], computerApprovals: [] },
    brief: { ...base.brief, confirmed: false },
  } as unknown as CardDetailsModel;
  expect(dock(value)).toMatchObject({ material: 'ask', line: 'Check the brief before drafting' });
  // A lead's brief is deferred (no decision yet), so the same step stays plainly raised.
  const lead = { ...card, state: 'lead', fit: null } as unknown as CardDetailsModel['card'];
  const leadValue = { ...value, card: lead, data: { ...value.data, cards: [lead] } };
  expect(dock(leadValue as CardDetailsModel).material).toBe('raised');
});
