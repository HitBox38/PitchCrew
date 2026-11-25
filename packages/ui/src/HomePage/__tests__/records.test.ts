import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import type { Snapshot } from '@pitchcrew/core';
import { attentionItems } from '@/lib/attention.ts';
import {
  browserApproval,
  confirmed,
  delivery,
  everyKind,
  pendingPacket,
  request,
} from '@/lib/__tests__/attention-fixture.ts';
import { ActionRefreshError } from '@/WorkspaceStore/action-errors.ts';
import type { Action } from '@/WorkspaceStore/types.ts';

// The app's own instance binds to the workspace and notification stores; these tests build one
// over a fake workspace instead, so they stub what the module imports.
vi.mock('@/WorkspaceStore/index.ts', () => ({
  useWorkspaceStore: { getState: () => ({ data: null }), subscribe: () => () => {} },
}));
vi.mock('@/Notifications/store.ts', () => ({
  useNotificationStore: { getState: () => ({ remoteRequests: [] }) },
}));

const { createDeskRecords } = await import('../records.ts');
const { deskEntries } = await import('../helpers.ts');

type Reply = (path: string, body: unknown, data: Snapshot) => Snapshot | Error;
/** The desk's `performance.now()`, moved by hand. */
const clock = { now: 1000 };

/**
 * A workspace whose action applies `reply` to the snapshot, as the store reloads before resolving,
 * then words its success toast as the store does (an empty toast shows nothing).
 */
const desk = (initial: Snapshot, reply: Reply, gate?: Promise<void>) => {
  const store = createStore<{ data: Snapshot }>(() => ({ data: initial }));
  const toasts: string[] = [];
  const sent = vi.fn<Action>(async (path, _method, body, success) => {
    await gate;
    const next = reply(path, body, store.getState().data);
    if (next instanceof Error) throw next;
    store.setState({ data: next });
    if (success) toasts.push(typeof success === 'function' ? success({}) : success);
    return {};
  });
  const records = createDeskRecords({
    action: () => sent,
    data: () => store.getState().data,
    items: (data) => attentionItems(data),
    subscribe: (listener) => store.subscribe(listener),
    now: () => clock.now,
  });
  const view = (kind: string) => {
    const data = store.getState().data;
    return { item: attentionItems(data).find((item) => item.kind === kind)!, data };
  };
  return { store, sent, toasts, records, view, state: () => records.store.getState() };
};

const data = everyKind();
const approved: Reply = (_path, _body, from) => ({
  ...from,
  computerApprovals: [browserApproval('approval-1', { status: 'approved' })],
});
const withoutCorvid = (from: Snapshot): Snapshot => ({
  ...from,
  queue: {
    ...from.queue!,
    queues: from.queue!.queues.filter((entry) => entry.id !== 'job:corvid'),
  },
});

describe('Desk records', () => {
  it('records a decision once its key leaves the list, and never shows the success toast', async () => {
    const { records, sent, toasts, view, state } = desk(data, approved);
    await records.deskAction(view('browser'))(
      '/computer-approvals/approval-1/decide',
      'POST',
      { approved: true },
      'Browser action approved for this run',
      { errorToast: true },
    );
    expect(sent).toHaveBeenCalledWith(
      '/computer-approvals/approval-1/decide',
      'POST',
      { approved: true },
      expect.any(Function),
      { errorToast: true },
    );
    // The record line and the live region say it; the toast words nothing.
    expect(toasts).toEqual(['']);
    const record = state().records['browser:approval-1'];
    expect(record).toMatchObject({
      subject: 'Initech',
      label: 'Browser action approval',
      bead: 'primary',
      calls: [{ path: '/computer-approvals/approval-1/decide', body: { approved: true } }],
    });
    expect(record?.text).toMatch(/^Approved: Click “Submit application”/);
    expect(state().latest).toMatchObject({ key: 'browser:approval-1', seq: record?.seq });
    expect(state().flights).toEqual({});
  });

  it('makes no record while the item stays, and keeps its calls for the next one', async () => {
    let step = 0;
    // Approving moves the packet to Choose how to apply; handing it to an agent puts its
    // preparation in the job's queue, which is crew work, so the item leaves.
    const handedOff = { method: 'agent', roleId: 'submitter', requestId: 'prep-1' } as const;
    const { records, toasts, view, state } = desk(data, (_path, _body, from) => {
      step += 1;
      return {
        ...from,
        approvals: [
          pendingPacket('packet-1', 'juniper', {
            ...from.approvals[0],
            status: 'approved',
            decidedAt: '2026-11-18T09:00:00.000Z',
            submission: step === 1 ? undefined : handedOff,
          }),
        ],
        chatRequests:
          step === 1 ? [] : [request('prep-1', { deliveries: [delivery('submitter', 'queued')] })],
      };
    });
    const packet = view('packet');
    await records.deskAction(packet)(
      '/approvals/packet-1/decide',
      'POST',
      { approved: true },
      'Packet approved',
    );
    expect(state().records).toEqual({});
    expect(state().calls['packet:packet-1']).toHaveLength(1);
    // No record says it, so the component's own toast does.
    expect(toasts).toEqual(['Packet approved']);
    await records.deskAction(view('packet'))(
      '/approvals/packet-1/submit',
      'POST',
      { method: 'agent', roleId: 'submitter' },
      () => 'Handed to Submitter',
    );
    expect(toasts).toEqual(['Packet approved', '']);
    expect(state().records['packet:packet-1']?.calls).toHaveLength(2);
    expect(state().records['packet:packet-1']?.text).toBe(
      'Handed to Submitter to prepare · nothing is submitted until you approve the final step',
    );
    expect(state().calls).toEqual({});
  });

  it('amends one record with a Skip’s trailing queue resume', async () => {
    const { records, view, state } = desk(data, (path, _body, from) =>
      path.startsWith('/chat-requests/') ? withoutCorvid(from) : from,
    );
    const act = records.deskAction(view('failure'));
    await act('/chat-requests/fit-corvid', 'PUT', { action: 'remove' });
    const first = state().records['failure:job:corvid'];
    // Only what completed so far: the removal.
    expect(first?.text).toBe('Skipped the fit evaluation');
    await act('/queue/job%3Acorvid', 'PUT', { action: 'resume' });
    const record = state().records['failure:job:corvid'];
    expect(Object.keys(state().records)).toEqual(['failure:job:corvid']);
    expect(record?.seq).toBe(first?.seq);
    expect(record?.calls.map((call) => (call.body as { action: string }).action)).toEqual([
      'remove',
      'resume',
    ]);
    expect(record?.text).toBe('Skipped the fit evaluation · the job’s queue continues');
    expect(state().flights).toEqual({});
  });

  it('says a Skip left its queue paused when the trailing resume fails, and records nothing when the removal fails', async () => {
    const refused = desk(data, (path, _body, from) =>
      path.startsWith('/chat-requests/') ? withoutCorvid(from) : new Error('Resume refused.'),
    );
    const act = refused.records.deskAction(refused.view('failure'));
    await act('/chat-requests/fit-corvid', 'PUT', { action: 'remove' });
    const made = refused.state().latest;
    await expect(act('/queue/job%3Acorvid', 'PUT', { action: 'resume' })).rejects.toThrow(
      'Resume refused.',
    );
    const record = refused.state().records['failure:job:corvid'];
    expect(record?.text).toBe('Skipped the fit evaluation · the job’s queue is still paused');
    expect(
      record?.calls.map((call) => [(call.body as { action: string }).action, call.failed]),
    ).toEqual([
      ['remove', undefined],
      ['resume', true],
    ]);
    // Amended in place: no second record, nothing announced again, nothing left in flight.
    expect(refused.state().latest).toBe(made);
    expect(refused.state()).toMatchObject({ flights: {}, calls: {}, unsettled: {} });
    // A resume the daemon saved, though the reload after it failed, did go through.
    const saved = desk(data, (path, _body, from) =>
      path.startsWith('/chat-requests/') ? withoutCorvid(from) : new ActionRefreshError({}, null),
    );
    const again = saved.records.deskAction(saved.view('failure'));
    await again('/chat-requests/fit-corvid', 'PUT', { action: 'remove' });
    await again('/queue/job%3Acorvid', 'PUT', { action: 'resume' }).catch(() => {});
    expect(saved.state().records['failure:job:corvid']?.text).toBe(
      'Skipped the fit evaluation · the job’s queue continues',
    );
    expect(saved.state()).toMatchObject({ calls: {}, unsettled: {} });
    // The removal itself refused: no record, and the row stays to be retried or skipped.
    const removal = desk(data, () => new Error('Remove refused.'));
    await expect(
      removal.records.deskAction(removal.view('failure'))('/chat-requests/fit-corvid', 'PUT', {
        action: 'remove',
      }),
    ).rejects.toThrow('Remove refused.');
    expect(removal.state()).toMatchObject({ records: {}, flights: {}, calls: {}, latest: null });
  });

  it('replaces the record when a key that came back is decided again', async () => {
    const failed = data.queue!.queues.find((entry) => entry.id === 'job:corvid')!;
    const { store, records, view, state } = desk(data, (_path, _body, from) => withoutCorvid(from));
    await records.deskAction(view('failure'))('/chat-requests/fit-corvid', 'PUT', {
      action: 'resume',
    });
    const first = state().records['failure:job:corvid'];
    // The lane failed again: the same key is live once more, beside its old record.
    store.setState({
      data: {
        ...data,
        queue: { ...data.queue!, queues: [...withoutCorvid(data).queue!.queues, failed] },
      },
    });
    const live = view('failure');
    expect(live.item.key).toBe('failure:job:corvid');
    const both = deskEntries(attentionItems(store.getState().data), state().records, {});
    expect(both.filter((entry) => entry.key.includes('failure:job:corvid'))).toHaveLength(2);
    await records.deskAction(live)('/chat-requests/fit-corvid', 'PUT', { action: 'resume' });
    const second = state().records['failure:job:corvid'];
    expect(second!.seq).toBeGreaterThan(first!.seq);
    expect(Object.keys(state().records)).toHaveLength(1);
  });

  it('keeps a row in place while its call runs, even when a poll leaves it out', async () => {
    let answer = () => {};
    const gate = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const { store, records, view, state } = desk(data, approved, gate);
    const call = records.deskAction(view('browser'))(
      '/computer-approvals/approval-1/decide',
      'POST',
      { approved: true },
    );
    // A poll answers first, without the item.
    store.setState({ data: approved('', {}, data) as Snapshot });
    const polled = attentionItems(store.getState().data);
    expect(deskEntries(polled, state().records, state().flights)[0]).toMatchObject({
      type: 'live',
      key: 'browser:approval-1',
      kept: data,
      busy: true,
    });
    answer();
    await call;
    const settled = deskEntries(polled, state().records, state().flights);
    expect(settled.find((entry) => entry.type === 'record')?.key).toMatch(
      /^record:browser:approval-1:\d{4}-/,
    );
    expect(
      settled.some((entry) => entry.type === 'live' && entry.key === 'browser:approval-1'),
    ).toBe(false);
  });

  it('draws a held row from the view it was decided from', () => {
    const view = { item: attentionItems(data).find((item) => item.kind === 'browser')!, data };
    const without = attentionItems(approved('', {}, data) as Snapshot);
    const entries = deskEntries(without, {}, { 'browser:approval-1': { view, count: 1 } });
    expect(entries.find((entry) => entry.key === 'browser:approval-1')).toMatchObject({
      type: 'live',
      kept: data,
      busy: true,
      tier: 1,
    });
    expect(entries[0]?.key).toBe('browser:approval-1');
  });

  it('settles a call saved while the reload failed once a snapshot shows its result', async () => {
    const { store, records, view, state } = desk(data, () => new ActionRefreshError({}, null));
    await expect(
      records.deskAction(view('browser'))('/computer-approvals/approval-1/decide', 'POST', {
        approved: true,
      }),
    ).rejects.toBeInstanceOf(ActionRefreshError);
    expect(state().records).toEqual({});
    expect(state().calls['browser:approval-1']).toHaveLength(1);
    expect(Object.keys(state().unsettled)).toEqual(['browser:approval-1']);
    // A chat stream update still carries the old snapshot: nothing is decided from it.
    store.setState({ data: { ...data, messages: [] } });
    expect(Object.keys(state().unsettled)).toEqual(['browser:approval-1']);
    store.setState({ data: approved('', {}, data) as Snapshot });
    expect(state().records['browser:approval-1']?.text).toMatch(/^Approved:/);
    expect(state().unsettled).toEqual({});
  });

  it('counts a saved call as moved in place when its item stays listed past a few polls', async () => {
    const { store, records, view, state } = desk(data, () => new ActionRefreshError({}, null));
    await records
      .deskAction(view('packet'))('/approvals/packet-1/decide', 'POST', { approved: true })
      .catch(() => {});
    clock.now += 11_000;
    try {
      store.setState({ data: { ...data } });
      expect(state()).toMatchObject({ records: {}, unsettled: {} });
      expect(state().calls['packet:packet-1']).toHaveLength(1);
    } finally {
      // A failed assertion must not leave the shared clock moved for the tests after it.
      clock.now = 1000;
    }
  });

  it('records nothing when a decision fails, and lets its row go', async () => {
    const { records, view, state } = desk(data, () => new Error('Refused.'));
    await expect(
      records.deskAction(view('browser'))('/computer-approvals/approval-1/decide', 'POST', {
        approved: true,
      }),
    ).rejects.toThrow('Refused.');
    expect(state()).toMatchObject({ records: {}, flights: {}, calls: {}, latest: null });
  });

  it('lists released queues for Up next', async () => {
    const { releasedQueues } = await import('../records.ts');
    const { records, view, state } = desk(data, (_path, _body, from) => withoutCorvid(from));
    await records.deskAction(view('failure'))('/chat-requests/fit-corvid', 'PUT', {
      action: 'resume',
    });
    expect([...releasedQueues(state().records)]).toEqual(['job:corvid']);
  });

  it('records a brief confirmed in job details opened from its row, and nothing else', () => {
    const quill = (applicationContext: ReturnType<typeof confirmed>, state = 'shortlisted') =>
      ({
        ...data,
        cards: data.cards.map((entry) =>
          entry.id === 'quill' ? { ...entry, state, applicationContext } : entry,
        ),
      }) as Snapshot;
    const isConfirmed = (fresh: Snapshot) =>
      !!fresh.cards.find((entry) => entry.id === 'quill')?.applicationContext?.confirmedAt;
    // Confirmed there: the row leaves and its record line says so, as a desk decision would.
    const { store, records, view, state } = desk(data, () => data);
    records.watch(view('brief'), isConfirmed);
    store.setState({ data: quill(confirmed()) });
    expect(state().records['brief:quill']).toMatchObject({
      subject: 'Quill Studio',
      text: 'Brief confirmed · Writer and Reviewer see only what you confirmed',
      calls: [],
    });
    expect(state().latest).toMatchObject({ key: 'brief:quill' });
    expect(state().watched).toEqual({});
    // Left for another reason (the job was withdrawn): no record.
    const other = desk(data, () => data);
    other.records.watch(other.view('brief'), isConfirmed);
    other.store.setState({ data: quill(undefined as never, 'withdrawn') });
    expect(other.state().records).toEqual({});
    expect(other.state().watched).toEqual({});
    // Job details closed without confirming: the watch ends after a few polls.
    const closed = desk(data, () => data);
    closed.records.watch(closed.view('brief'), isConfirmed);
    closed.records.release();
    expect(Object.keys(closed.state().watched)).toEqual(['brief:quill']);
    clock.now += 10_001;
    closed.store.setState({ data: { ...data } });
    expect(closed.state().watched).toEqual({});
    expect(closed.state().records).toEqual({});
  });
});
