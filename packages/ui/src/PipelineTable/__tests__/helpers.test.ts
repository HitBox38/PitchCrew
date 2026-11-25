import { describe, expect, it } from 'vitest';
import type { Snapshot } from '@pitchcrew/core';
import { attentionCounts, attentionItems } from '@/lib/attention.ts';
import { liveRunIndex } from '@/lib/live-runs.ts';
import { queueStories } from '@/lib/queue-story.ts';
import { queueAttention } from '@/QueueWidget/helpers.ts';
import {
  ago,
  brief,
  browserApproval,
  card,
  confirmed,
  delivery,
  now,
  question,
  queue,
  request,
  roleProposal,
  roles,
  run,
  signal,
  snapshot,
} from '@/lib/__tests__/attention-fixture.ts';
import { installed } from '@/lib/__tests__/crew-lens-fixture.ts';
import { tableColumns, tableViews } from '../constants.ts';
import {
  emptyLine,
  needsCaption,
  pageColumns,
  pageGroups,
  rangeLabel,
  selectionFacts,
  tableRows,
  tableView,
  togglePage,
  updatedLabel,
  viewCounts,
  viewDef,
  viewFacts,
  visibleRows,
} from '../helpers.ts';

const fit = (id: string) =>
  request(`fit-${id}`, {
    boardAction: 'fit',
    content: 'Evaluate fit',
    deliveries: [delivery('scout', 'queued')],
  });

/** Two busy slots, a failure, a question, two fits in line, a pause, an idle job and a closed one. */
const workspace = (): Snapshot => {
  const submit = run('run-submit', {
    cardId: 'initech',
    roleId: 'submitter',
    threadId: 't-initech',
    startedAt: ago(18),
  });
  const draft = run('run-acme', {
    cardId: 'acme',
    threadId: 't-acme',
    purpose: 'application-draft',
    startedAt: ago(12),
  });
  const failed = run('run-corvid', {
    cardId: 'corvid',
    roleId: 'scout',
    status: 'failed',
    purpose: 'fit',
    startedAt: ago(60),
    finishedAt: ago(50),
  });
  return snapshot({
    cards: [
      card('initech', { company: 'Initech', state: 'awaiting_approval', updatedAt: ago(5) }),
      card('acme', { company: 'Acme Robotics', state: 'drafting', updatedAt: ago(30) }),
      card('corvid', { company: 'Corvid', applicationContext: brief() }),
      card('umbra', { company: 'Umbra Health', state: 'drafting' }),
      card('north', { company: 'Northwind', applicationContext: brief(), updatedAt: ago(1) }),
      card('kestrel', { company: 'Kestrel AI', applicationContext: brief() }),
      card('paused', { company: 'Paused Co', applicationContext: brief() }),
      card('quiet', { company: 'Quiet Co', state: 'shortlisted', applicationContext: confirmed() }),
      card('gone', { company: 'Gone Co', state: 'rejected', updatedAt: ago(3) }),
      card('old', { company: 'Old Co', state: 'withdrawn', updatedAt: ago(900) }),
    ],
    runs: [submit, draft, failed],
    computerApprovals: [browserApproval('approval-1')],
    userInputs: [question('question-1')],
    proposals: [roleProposal('proposal-1')],
    trackingSignals: [signal('signal-gone', { candidateIds: ['gone'], company: 'Gone Co' })],
    queue: {
      concurrency: 2,
      active: 2,
      background: 0,
      queues: [
        queue('job:initech', { state: 'running', runs: [submit] }),
        queue('job:acme', { state: 'running', runs: [draft] }),
        queue('job:corvid', {
          state: 'paused',
          paused: true,
          pauseKind: 'failed',
          requests: [
            request('fit-corvid', {
              boardAction: 'fit',
              deliveries: [delivery('scout', 'failed', 'run-corvid')],
            }),
          ],
        }),
        queue('job:umbra', {
          state: 'waiting',
          requests: [
            request('draft-umbra', {
              boardAction: 'draft',
              deliveries: [delivery('writer', 'waiting', 'run-ask')],
            }),
          ],
        }),
        queue('job:north', { requests: [fit('north')] }),
        queue('job:kestrel', { requests: [fit('kestrel')] }),
        queue('job:paused', {
          state: 'paused',
          paused: true,
          pauseKind: 'user',
          requests: [fit('paused')],
        }),
      ],
    },
  });
};

/** The table's rows, with the fixture agents' runtime installed unless the test lists runtimes. */
const build = (snapshotData: Snapshot, closed = false) => {
  const data = installed(snapshotData);
  const items = attentionItems(data);
  const stories = queueStories(data, items, liveRunIndex(data), now);
  return { items, rows: tableRows(data, items, stories, closed, now) };
};
const ids = (rows: readonly { card: { id: string } }[]) => rows.map((row) => row.card.id);

describe('pipeline table helpers', () => {
  it('puts each open job in its views and counts them, Failed by the app-bar chip’s rule', () => {
    const data = workspace();
    const { rows } = build(data);
    const counts = viewCounts(rows, '');
    const members = (view: (typeof tableViews)[number]['id']) =>
      ids(visibleRows(rows, view, '')).toSorted();
    expect(members('all')).toHaveLength(8);
    expect(members('needs-you')).toEqual(['corvid', 'initech', 'umbra']);
    expect(members('working')).toEqual(['acme', 'initech']);
    expect(members('waiting')).toEqual(['kestrel', 'north']);
    expect(members('on-hold')).toEqual(['corvid', 'paused', 'umbra']);
    expect(members('failed')).toEqual(['corvid']);
    expect(members('not-scored')).toEqual(['corvid', 'kestrel', 'north', 'paused']);
    expect(counts.failed.total).toBe(queueAttention(data.queue!).failed);
    for (const view of tableViews)
      expect(counts[view.id]).toEqual({
        matching: members(view.id).length,
        total: members(view.id).length,
      });
  });

  it('orders All open by group: Needs you by rank, Working by update, the line by place', () => {
    const { rows } = build(workspace());
    expect(rows.map((row) => [row.card.id, row.group])).toEqual([
      ['initech', 'needs'],
      ['corvid', 'needs'],
      ['umbra', 'needs'],
      ['acme', 'working'],
      ['north', 'waiting'],
      ['kestrel', 'waiting'],
      ['paused', 'held'],
      ['quiet', 'idle'],
    ]);
    const groups = pageGroups(rows, true);
    expect(groups.map((group) => [group.id, ids(group.rows)])).toEqual([
      ['needs', ['initech', 'corvid', 'umbra']],
      ['working', ['acme']],
      ['waiting', ['north', 'kestrel']],
      ['held', ['paused']],
      ['idle', ['quiet']],
    ]);
    // Other views keep the same order without labels.
    expect(pageGroups(visibleRows(rows, 'not-scored', ''), false)).toEqual([
      { id: null, rows: visibleRows(rows, 'not-scored', '') },
    ]);
    expect(ids(visibleRows(rows, 'not-scored', ''))).toEqual([
      'corvid',
      'north',
      'kestrel',
      'paused',
    ]);
  });

  it('keeps a queue behind a promoted brief out of Waiting for a slot, as it takes no place', () => {
    const data = workspace();
    data.cards.push(
      card('quill', { company: 'Quill Studio', state: 'shortlisted', applicationContext: brief() }),
    );
    data.queue!.queues.push(
      queue('job:quill', {
        requests: [
          request('draft-quill', {
            boardAction: 'draft',
            deliveries: [delivery('writer', 'queued')],
          }),
        ],
      }),
    );
    const { rows } = build(data);
    const quill = rows.find((row) => row.card.id === 'quill')!;
    expect(quill.views).toEqual(['all', 'needs-you']);
    expect(quill.group).toBe('needs');
    expect(ids(visibleRows(rows, 'waiting', '')).toSorted()).toEqual(['kestrel', 'north']);
    expect(viewCounts(rows, '').waiting.total).toBe(2);
  });

  it('puts a ready job whose agent cannot start on hold, not in line for a slot', () => {
    const data = workspace();
    data.roles = roles.map((role) => (role.id === 'scout' ? { ...role, enabled: false } : role));
    const { rows } = build(data);
    const north = rows.find((row) => row.card.id === 'north')!;
    expect(north.views).toEqual(['all', 'on-hold', 'not-scored']);
    expect(north.group).toBe('held');
    expect(north.story).toMatchObject({ kind: 'held', tone: 'ochre', text: 'paused' });
    expect(viewCounts(rows, '').waiting.total).toBe(0);
  });

  it('writes Updated in the Queue cell’s lower case, then the date after a day', () => {
    expect(updatedLabel(ago(0), now)).toBe('just now');
    expect(updatedLabel(ago(3), now)).toBe('3m ago');
    expect(updatedLabel(ago(150), now)).toBe('2h ago');
    expect(updatedLabel(ago(3 * 1440), now)).toBe(
      new Date(ago(3 * 1440)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    );
    const { rows } = build(workspace());
    expect(rows.find((row) => row.card.id === 'north')?.updated).toBe('1m ago');
  });

  it('lists closed jobs newest first in the Closed view', () => {
    const { rows } = build(workspace(), true);
    expect(ids(rows)).toEqual(['gone', 'old']);
    // A closed job's tracking review still speaks in its Queue cell and links to Home.
    expect(rows[0]!.story).toMatchObject({ kind: 'asks', itemKey: 'tracking:signal-gone' });
    expect(rows[1]!.story).toMatchObject({ kind: 'idle', text: '' });
    // Its Queue column stays while a closed row on the page has something to say, and goes
    // rather than head a blank column; open jobs always have it.
    expect(pageColumns(true, rows)).toEqual(tableColumns);
    expect(pageColumns(true, rows.slice(1)).map(([id]) => id)).toEqual([
      'company',
      'title',
      'stage',
      'fit',
      'updated',
    ]);
    expect(pageColumns(false, [])).toEqual(tableColumns);
  });

  it('captions Needs you with the items Home still holds beyond the listed jobs', () => {
    const data = workspace();
    const { items, rows } = build(data);
    // Three jobs wait; the job-free proposal and the closed job's tracking review stay on Home.
    expect(attentionCounts(items).home).toBe(5);
    expect(needsCaption(rows, items)).toEqual({ text: '3 jobs wait on you', more: 2 });
    const one = rows.filter((row) => row.card.id === 'initech');
    expect(needsCaption(one, items)).toEqual({ text: '1 job waits on you', more: 4 });
  });

  it('counts matches while searching and keys an empty view with a socket', () => {
    const { rows } = build(workspace());
    const counts = viewCounts(rows, 'kestrel');
    expect(counts.waiting).toEqual({ matching: 1, total: 2 });
    expect(viewFacts(viewDef('waiting'), counts.waiting, 'kestrel')).toEqual({
      count: '1 of 2',
      tone: 'socket',
    });
    expect(viewFacts(viewDef('failed'), counts.failed, 'kestrel')).toEqual({
      count: '0 of 1',
      tone: 'socket',
    });
    expect(viewFacts(viewDef('failed'), viewCounts(rows, '').failed, '')).toEqual({
      count: '1',
      tone: 'rose',
    });
    expect(viewFacts(viewDef('all'), counts.all, '').tone).toBeUndefined();
    expect(ids(visibleRows(rows, 'waiting', 'kestrel'))).toEqual(['kestrel']);
  });

  it('names pages, empty views and unknown views plainly', () => {
    expect(rangeLabel(0, 40, 114)).toBe('1–40 of 114 jobs');
    expect(rangeLabel(80, 114, 114)).toBe('81–114 of 114 jobs');
    expect(rangeLabel(40, 41, 41)).toBe('41 of 41 jobs');
    expect(rangeLabel(0, 1, 1)).toBe('1 of 1 job');
    expect(rangeLabel(0, 0, 0)).toBe('0 jobs');
    expect(emptyLine('failed', 0, '')).toBe('Nothing failed.');
    expect(emptyLine('working', 3, 'zzz')).toBe('None of the 3 jobs in Working match “zzz”.');
    expect(emptyLine('waiting', 1, 'zzz')).toBe(
      'The one job in Waiting for a slot does not match “zzz”.',
    );
    expect(emptyLine(null, 0, '')).toBe('No closed jobs.');
    expect(tableView('not-scored')).toBe('not-scored');
    expect(tableView('since-last-night')).toBe('all');
    expect(tableView(undefined)).toBe('all');
  });

  it('keeps a selection across pages and views and toggles the current page', () => {
    const page = ['a', 'b'];
    const view = new Set(['a', 'b', 'c']);
    expect(selectionFacts(['a', 'c', 'z'], page, view)).toEqual({
      count: 3,
      onPage: 1,
      otherPages: 1,
      notShown: 1,
      all: false,
      some: true,
    });
    expect(selectionFacts(['a', 'b'], page, view)).toMatchObject({ all: true, some: true });
    expect(selectionFacts([], [], view)).toMatchObject({ all: false, some: false });
    expect(togglePage(['c', 'a'], page, false)).toEqual(['c', 'a', 'b']);
    expect(togglePage(['c', 'a', 'b'], page, true)).toEqual(['c']);
  });
});
