import {
  defaultCapabilities,
  type Card,
  type Role,
  type TrackingSignal,
  type TrackingScan,
} from '@pitchcrew/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, resources, setup } from './helpers/daemon.ts';
import { sourceState } from '../src/crew/tracking/helpers.ts';

const mailbox = 'fixture@example.com';
const external = {
  company: 'Fictional Labs',
  title: 'Frontend Engineer',
  url: 'https://jobs.example.com/roles/123?utm_source=board',
  submittedAt: '2025-01-01T00:00:00Z',
  note: 'Confirmed on the external careers page.',
};
const body =
  'Fictional Labs Frontend Engineer: we would like to invite you to an interview. https://jobs.example.com/roles/123';
afterEach(async () => {
  for (const { daemon } of resources) {
    daemon.service.controllers.delete('tracking-fixture');
    daemon.service.capabilities.delete('tracking-token');
  }
  await cleanup();
});
async function fixture() {
  const context = await setup(14586);
  const { daemon, request } = context;
  const current = daemon.service.board.get<Role>('role', 'scout');
  daemon.service.board.record(
    'role',
    {
      ...current,
      capabilities: {
        ...defaultCapabilities,
        readApplications: true,
        trackApplications: true,
        gmail: true,
      },
    },
    'user',
    'Enable fictional tracker capabilities',
  );
  daemon.service.capabilities.set('tracking-token', {
    roleId: 'scout',
    cardId: null,
    runId: 'tracking-fixture',
  });
  daemon.service.controllers.set('tracking-fixture', new AbortController());
  vi.spyOn(daemon.service.connectors, 'status').mockReturnValue([
    {
      id: 'google',
      connected: true,
      account: mailbox,
      services: ['gmail'],
      configured: true,
      pending: false,
      error: '',
    },
  ]);
  const gmail = vi
    .spyOn(daemon.service.connectors, 'call')
    .mockImplementation(async (tool, data) => {
      if (tool === 'gmail_search_messages') return { messages: [{ id: 'm1' }] };
      const id = (data as { messageId: string }).messageId;
      return {
        id,
        threadId: 'thread1',
        internalDate: String(Date.parse('2025-03-01T00:00:00Z')),
        text: body,
        headers: [
          { name: 'Subject', value: 'Interview invitation' },
          { name: 'From', value: 'recruiting@fictional.example' },
        ],
      };
    });
  const agent = async <T>(action: string, input: unknown) => {
    const response = await fetch(`${daemon.url}/api/agent`, {
      method: 'POST',
      headers: { authorization: 'Bearer tracking-token', 'content-type': 'application/json' },
      body: JSON.stringify({ action, input }),
    });
    return { response, result: (await response.json()) as T };
  };
  const register = async (patch = {}) =>
    (await request<Card>('/tracking/external', 'POST', { ...external, ...patch })).result;
  const scan = async () =>
    (
      await agent<{ scan: TrackingScan }>('tracking_scan', {
        query: 'from:recruiting@fictional.example',
      })
    ).result.scan;
  const reconcile = async (scanId: string, patch = {}) =>
    agent<{ evidence: TrackingSignal; error?: string }>('tracking_reconcile', {
      scanId,
      messageId: 'm1',
      company: external.company,
      title: external.title,
      state: 'interviewing',
      quote: 'we would like to invite you to an interview.',
      ...patch,
    });
  return { ...context, gmail, agent, register, scan, reconcile };
}

describe('verified application reconciliation', () => {
  it('lets only users register a known external submission on an existing lead without duplicating it or exporting a packet', async () => {
    const { request, daemon, agent } = await fixture();
    const card = (
      await request<Card>('/cards', 'POST', { company: external.company, title: external.title })
    ).result;
    const path = `/tracking/applications/${card.id}/external`;
    expect(
      (await request(`/cards/${card.id}/move`, 'POST', { state: 'submitted' })).response.status,
    ).toBe(400);
    expect(
      (
        await fetch(`${daemon.url}/api${path}`, {
          method: 'POST',
          headers: { authorization: 'Bearer tracking-token', 'content-type': 'application/json' },
          body: JSON.stringify(external),
        })
      ).status,
    ).toBe(403);
    const result = await request<Card>(path, 'POST', {
      submittedAt: external.submittedAt,
      note: external.note,
    });
    expect(result.result).toMatchObject({
      id: card.id,
      state: 'submitted',
      packet: null,
      tracking: { origin: 'external' },
    });
    expect(daemon.service.board.list('card')).toHaveLength(1);
    expect(daemon.service.board.list('approval')).toEqual([]);
    expect(
      (
        await agent('register_existing_external', {
          cardId: card.id,
          submittedAt: external.submittedAt,
          note: external.note,
        })
      ).response.status,
    ).toBe(400);
  });
  it('consumes overlapping pending query pages when another scan already processed the same message', async () => {
    const { daemon, register, scan, reconcile, agent, gmail } = await fixture();
    await register();
    const first = await scan();
    const second = (
      await agent<{ scan: TrackingScan }>('tracking_scan', { query: 'subject:interview' })
    ).result.scan;
    expect(second.pendingIds).toEqual(['m1']);
    await reconcile(first.id);
    const reads = gmail.mock.calls.length;
    expect((await reconcile(second.id)).result.evidence.status).toBe('applied');
    expect(gmail.mock.calls.length).toBe(reads);
    expect(daemon.service.board.get<TrackingScan>('tracking_scan', second.id).pendingIds).toEqual(
      [],
    );
    expect(daemon.service.board.list('tracking_signal')).toHaveLength(1);
  });
  it('registers known external submissions, prevents canonical duplicates, and retains export gates', async () => {
    const { request, daemon, register, agent } = await fixture();
    const card = await register();
    expect(card).toMatchObject({
      state: 'submitted',
      packet: null,
      tracking: { origin: 'external', submittedAt: external.submittedAt },
    });
    expect(
      (
        await request('/tracking/external', 'POST', {
          ...external,
          url: 'https://jobs.example.com/roles/123?utm_campaign=mail',
        })
      ).response.status,
    ).toBe(400);
    expect(
      (
        await request('/tracking/external', 'POST', {
          ...external,
          title: 'Backend Engineer',
          submittedAt: '2099-01-01T00:00:00Z',
        })
      ).response.status,
    ).toBe(400);
    expect(daemon.service.board.list('approval')).toEqual([]);
    expect((await request(`/cards/${card.id}/approval`, 'POST', {})).response.ok).toBe(false);
    const found = await agent<{ cards: Card[] }>('applications', {
      company: 'fictional',
      title: 'frontend',
      limit: 1,
    });
    expect(found.result.cards.map((value) => value.id)).toEqual([card.id]);
    expect((await agent('applications', { limit: 51 })).response.status).toBe(400);
    expect((await agent('register_external', external)).response.status).toBe(400);
  });
  it('applies one stable source-backed match atomically and deduplicates scans, queries and replay', async () => {
    const { daemon, register, scan, reconcile, agent } = await fixture();
    const card = await register();
    const current = await scan();
    expect(current.pendingIds).toEqual(['m1']);
    const result = await reconcile(current.id);
    expect(result.result.evidence).toMatchObject({
      status: 'applied',
      cardId: card.id,
      messageId: 'm1',
      threadId: 'thread1',
      source: 'gmail',
      account: mailbox,
    });
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('interviewing');
    const before = daemon.service.board.events().length;
    expect((await reconcile(current.id)).result.evidence.id).toBe(result.result.evidence.id);
    expect(daemon.service.board.events().length).toBe(before);
    expect((await scan()).pendingIds).toEqual([]);
    expect(
      (await agent<{ scan: TrackingScan }>('tracking_scan', { query: 'interview' })).result.scan
        .pendingIds,
    ).toEqual([]);
    const saved = daemon.service.board.list('tracking_signal');
    daemon.service.board.rebuild();
    expect(daemon.service.board.list('tracking_signal')).toEqual(saved);
    expect(
      daemon.service.board
        .events()
        .some((event) => event.kind === 'tracking_signal' && event.version === 9),
    ).toBe(true);
  });
  it('keeps an incomplete page durable across failure/rebuild and finds new messages on a later sweep', async () => {
    const { daemon, gmail, register, scan, reconcile } = await fixture();
    await register();
    gmail.mockResolvedValueOnce({ messages: [{ id: 'm1' }], nextPageToken: 'page2' });
    const first = await scan();
    gmail.mockRejectedValueOnce(new Error('Mailbox temporarily unavailable'));
    expect((await reconcile(first.id)).response.status).toBe(400);
    daemon.service.board.rebuild();
    expect((await scan()).pendingIds).toEqual(['m1']);
    expect(gmail).toHaveBeenCalledTimes(2);
    await reconcile(first.id);
    gmail.mockResolvedValueOnce({ messages: [] });
    expect((await scan()).complete).toBe(true);
    expect(gmail).toHaveBeenLastCalledWith(
      'gmail_search_messages',
      { query: 'from:recruiting@fictional.example', limit: 20, pageToken: 'page2' },
      expect.any(AbortSignal),
    );
    gmail.mockResolvedValueOnce({ messages: [{ id: 'm2' }, { id: 'm1' }] });
    expect((await scan()).pendingIds).toEqual(['m2']);
    expect(gmail).toHaveBeenLastCalledWith(
      'gmail_search_messages',
      { query: 'from:recruiting@fictional.example', limit: 20 },
      expect.any(AbortSignal),
    );
  });
  it('rejects invented evidence and current permission revocation without consuming the pending message', async () => {
    const { daemon, register, scan, reconcile, agent, gmail } = await fixture();
    await register();
    const current = await scan();
    expect((await reconcile(current.id, { quote: 'invented quotation' })).response.status).toBe(
      400,
    );
    const role = daemon.service.board.get<Role>('role', 'scout');
    daemon.service.board.record(
      'role',
      { ...role, capabilities: { ...role.capabilities!, trackApplications: false } },
      'user',
      'Revoke tracking',
    );
    expect((await reconcile(current.id)).response.status).toBe(400);
    expect((await agent('applications', {})).response.status).toBe(200);
    expect(gmail).toHaveBeenCalledTimes(2);
    expect(daemon.service.board.get<TrackingScan>('tracking_scan', current.id).pendingIds).toEqual([
      'm1',
    ]);
    expect(daemon.service.board.list('tracking_signal')).toEqual([]);
  });
  it('rechecks permissions after Gmail resolves and preserves retryable scan state', async () => {
    const { daemon, register, scan, reconcile, gmail } = await fixture();
    await register();
    const current = await scan();
    const role = daemon.service.board.get<Role>('role', 'scout');
    gmail.mockImplementationOnce(async () => {
      daemon.service.board.record(
        'role',
        { ...role, capabilities: { ...role.capabilities!, gmail: false } },
        'user',
        'Revoke Gmail in flight',
      );
      return {
        id: 'm1',
        threadId: 'thread1',
        internalDate: String(Date.parse('2025-03-01T00:00:00Z')),
        text: body,
        headers: [],
      };
    });
    expect((await reconcile(current.id)).response.status).toBe(400);
    expect(daemon.service.board.get<TrackingScan>('tracking_scan', current.id).pendingIds).toEqual([
      'm1',
    ]);
    expect(daemon.service.board.list('tracking_signal')).toEqual([]);
  });
  it('saves ambiguous identities for exact user decisions and links the approved thread', async () => {
    const { daemon, request, register, scan, reconcile, gmail } = await fixture();
    const card = await register();
    const second = await register({ url: 'https://jobs.example.com/roles/456' });
    const current = await scan();
    gmail.mockResolvedValueOnce({
      id: 'm1',
      threadId: 'thread1',
      internalDate: String(Date.parse('2025-03-01T00:00:00Z')),
      text: body.replace(' https://jobs.example.com/roles/123', ''),
      headers: [],
    });
    const evidence = (await reconcile(current.id)).result.evidence;
    expect(evidence).toMatchObject({ status: 'pending', candidateIds: [card.id, second.id] });
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('submitted');
    expect(
      (await request(`/tracking/evidence/${evidence.id}/decision`, 'POST', { approved: true }))
        .response.status,
    ).toBe(400);
    expect(
      (
        await request(`/tracking/evidence/${evidence.id}/decision`, 'POST', {
          approved: true,
          cardId: card.id,
        })
      ).response.status,
    ).toBe(200);
    expect(daemon.service.board.get<Card>('card', card.id)).toMatchObject({
      state: 'interviewing',
      tracking: { gmailThreads: [{ account: mailbox, threadId: 'thread1' }] },
    });
    expect(
      (
        await request(`/tracking/evidence/${evidence.id}/decision`, 'POST', {
          approved: true,
          cardId: card.id,
        })
      ).response.status,
    ).toBe(400);
    expect(
      (
        await request(`/tracking/applications/${card.id}/thread`, 'DELETE', {
          account: mailbox,
          threadId: 'thread1',
        })
      ).response.status,
    ).toBe(200);
    expect(daemon.service.board.get<Card>('card', card.id).tracking?.gmailThreads).toEqual([]);
    expect(
      (
        await request(
          `/tracking/evidence/${evidence.id}/decision`,
          'POST',
          { approved: false },
          { origin: 'https://evil.example' },
        )
      ).response.status,
    ).toBe(403);
  });
  it('resolves unmatched evidence after user registration without re-fetching or granting approvals', async () => {
    const { daemon, request, register, scan, reconcile } = await fixture();
    const evidence = (await reconcile((await scan()).id)).result.evidence;
    expect(evidence.candidateIds).toEqual([]);
    const card = await register();
    expect(
      (
        await request(`/tracking/evidence/${evidence.id}/decision`, 'POST', {
          approved: true,
          cardId: card.id,
        })
      ).response.status,
    ).toBe(400);
    expect(
      (
        await request(`/tracking/evidence/${evidence.id}/decision`, 'POST', {
          approved: true,
          cardId: card.id,
          cardUpdatedAt: card.updatedAt,
        })
      ).response.status,
    ).toBe(200);
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('interviewing');
    expect(daemon.service.board.list('approval')).toEqual([]);
  });
  it('blocks older evidence after user status corrections and cannot approve an invalid transition', async () => {
    const { daemon, request, register, scan, reconcile } = await fixture();
    const card = await register();
    daemon.service.board.move(card.id, 'screening', 'user', 'User confirmed a recent phone screen');
    const evidence = (await reconcile((await scan()).id)).result.evidence;
    expect(evidence).toMatchObject({
      status: 'pending',
      reason: 'Older than the latest evidence or user status correction.',
    });
    expect(
      (
        await request(`/tracking/evidence/${evidence.id}/decision`, 'POST', {
          approved: true,
          cardId: card.id,
        })
      ).response.status,
    ).toBe(400);
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('screening');
    expect(
      (await request(`/tracking/evidence/${evidence.id}/decision`, 'POST', { approved: false }))
        .response.status,
    ).toBe(200);
  });
  it('uses user-linked thread identity for follow-ups and rejects same-time conflicting signals', async () => {
    const { daemon, request, register, scan, reconcile, gmail } = await fixture();
    const card = await register({ url: '' });
    await request(`/tracking/applications/${card.id}/thread`, 'POST', { threadId: 'thread1' });
    gmail.mockResolvedValueOnce({ messages: [{ id: 'm1' }, { id: 'm2' }] });
    const current = await scan();
    gmail.mockResolvedValueOnce({
      id: 'm1',
      threadId: 'thread1',
      internalDate: String(Date.parse('2025-03-01T00:00:00Z')),
      text: 'we would like to invite you to an interview.',
      headers: [],
    });
    expect((await reconcile(current.id)).result.evidence.status).toBe('applied');
    gmail.mockResolvedValueOnce({
      id: 'm2',
      threadId: 'thread1',
      internalDate: String(Date.parse('2025-03-01T00:00:00Z')),
      text: 'we will not be moving forward with your application.',
      headers: [],
    });
    const other = (
      await reconcile(current.id, {
        messageId: 'm2',
        state: 'rejected',
        quote: 'we will not be moving forward with your application.',
      })
    ).result.evidence;
    expect(other).toMatchObject({
      status: 'pending',
      reason: 'Conflicting evidence at the same time.',
    });
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('interviewing');
  });
  it('requires stable source identity, does not trust company/title alone, and rejects quote omissions', async () => {
    const { daemon, register, scan, reconcile, gmail } = await fixture();
    const card = await register({ url: '' });
    expect((await reconcile((await scan()).id)).result.evidence.status).toBe('pending');
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('submitted');
    gmail.mockResolvedValueOnce({ messages: [{ id: 'm2' }] });
    const current = await scan();
    await register({ title: 'Backend Engineer' });
    gmail.mockResolvedValueOnce({
      id: 'm2',
      threadId: 'thread2',
      internalDate: String(Date.parse('2025-03-01T00:00:00Z')),
      text: 'Fictional Labs Backend Engineer. We cannot proceed. Earlier: we would like to invite you to an interview. https://jobs.example.com/roles/123',
      headers: [],
    });
    const next = await reconcile(current.id, { messageId: 'm2', title: 'Backend Engineer' });
    expect(next.result.evidence.status).toBe('pending');
    expect(next.result.evidence.sourceText).toContain('We cannot proceed.');
    expect(next.result.evidence.reason).toContain('conflicting');
  });
  it('disambiguates equal company/title by a unique source URL and exact labeled job identifier', async () => {
    const { daemon, register, scan, reconcile, gmail } = await fixture();
    const first = await register();
    const second = await register({
      url: 'https://jobs.example.com/roles/456',
      jobIdentifier: 'JOB-456',
    });
    gmail.mockResolvedValueOnce({ messages: [{ id: 'm1' }, { id: 'm2' }] });
    const current = await scan();
    expect((await reconcile(current.id)).result.evidence).toMatchObject({
      status: 'applied',
      cardId: first.id,
    });
    gmail.mockResolvedValueOnce({
      id: 'm2',
      threadId: 'thread2',
      internalDate: String(Date.parse('2025-03-02T00:00:00Z')),
      text: 'Fictional Labs Frontend Engineer. Job ID: JOB-456. We would like to invite you to an interview.',
      headers: [],
    });
    expect(
      (
        await reconcile(current.id, {
          messageId: 'm2',
          quote: 'We would like to invite you to an interview.',
        })
      ).result.evidence,
    ).toMatchObject({ status: 'applied', cardId: second.id });
    expect(daemon.service.board.get<Card>('card', second.id).state).toBe('interviewing');
  });
  it('saves truncated or snippet-only Gmail sources for review and preserves source context', async () => {
    const { register, scan, reconcile, gmail } = await fixture();
    await register();
    gmail.mockResolvedValueOnce({ messages: [{ id: 'm1' }, { id: 'm2' }] });
    const current = await scan();
    gmail.mockResolvedValueOnce({
      id: 'm1',
      threadId: 'thread1',
      internalDate: String(Date.parse('2025-03-01T00:00:00Z')),
      text: body,
      textTruncated: true,
      headers: [],
    });
    expect((await reconcile(current.id)).result.evidence).toMatchObject({
      status: 'pending',
      sourceTruncated: true,
      sourceText: expect.stringContaining('Fictional Labs'),
      reason: expect.stringContaining('incomplete'),
    });
    gmail.mockResolvedValueOnce({
      id: 'm2',
      threadId: 'thread2',
      internalDate: String(Date.parse('2025-03-01T00:00:00Z')),
      text: '',
      snippet: body,
      headers: [],
    });
    expect((await reconcile(current.id, { messageId: 'm2' })).result.evidence).toMatchObject({
      status: 'pending',
      sourceTruncated: true,
    });
  });
  it('lets users correct identifiers and refresh stale comparisons without bypassing state transitions', async () => {
    const { daemon, request, register, scan, reconcile, gmail } = await fixture();
    const card = await register({ url: '' });
    const signal = (await reconcile((await scan()).id)).result.evidence;
    const path = `/tracking/evidence/${signal.id}`;
    expect(
      (
        await request(`/tracking/applications/${card.id}/identifier`, 'PUT', {
          jobIdentifier: 'JOB-123',
        })
      ).response.status,
    ).toBe(200);
    expect(
      (await request(`${path}/decision`, 'POST', { approved: true, cardId: card.id })).response
        .status,
    ).toBe(400);
    expect((await request(`${path}/refresh`, 'POST', {})).response.status).toBe(200);
    expect(
      (await request(`${path}/decision`, 'POST', { approved: true, cardId: card.id })).response
        .status,
    ).toBe(200);
    gmail.mockResolvedValueOnce({ messages: [{ id: 'm2' }] });
    const current = await scan();
    gmail.mockResolvedValueOnce({
      id: 'm2',
      threadId: 'thread1',
      internalDate: String(Date.parse('2025-03-02T00:00:00Z')),
      text: 'We are pleased to extend an offer.',
      headers: [],
    });
    expect(
      (
        await reconcile(current.id, {
          messageId: 'm2',
          state: 'offer',
          quote: 'We are pleased to extend an offer.',
        })
      ).result.evidence.status,
    ).toBe('applied');
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('offer');
    gmail.mockResolvedValueOnce({ messages: [{ id: 'm3' }] });
    const next = await scan();
    gmail.mockResolvedValueOnce({
      id: 'm3',
      threadId: 'thread1',
      internalDate: String(Date.parse('2025-03-03T00:00:00Z')),
      text: 'We will not be moving forward with your application.',
      headers: [],
    });
    const invalid = (
      await reconcile(next.id, {
        messageId: 'm3',
        state: 'rejected',
        quote: 'We will not be moving forward with your application.',
      })
    ).result.evidence;
    expect(invalid).toMatchObject({ status: 'pending', reason: 'Cannot move offer to rejected.' });
    expect(
      (
        await request(`/tracking/evidence/${invalid.id}/decision`, 'POST', {
          approved: true,
          cardId: card.id,
        })
      ).response.status,
    ).toBe(400);
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('offer');
  });
});

describe('conservative status recognition', () => {
  it.each([
    ['We decided to proceed with your application.', null],
    ['We decided not to proceed with your application.', 'rejected'],
    ['We cannot invite you to an interview.', null],
    ['We are not pleased to offer you a job.', null],
    ['Please schedule an interview. This is not an invitation.', null],
    ['Thank you for applying. We will not be moving forward with your application.', null],
    ['We will not be moving forward with your application.\n> Please schedule an interview.', null],
    ['On Monday wrote: we would like to invite you to an interview.', null],
    ['We would like to invite you to an interview.', 'interviewing'],
    ['We are pleased to extend an offer.', 'offer'],
  ])('recognizes %s conservatively', (text, expected) => expect(sourceState(text)).toBe(expected));
});
