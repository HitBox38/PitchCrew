import { describe, expect, it } from 'vitest';
import type { LensEntry, LensRow } from '@/lib/crew-lens.ts';
import { entryAction, entryLabel, groupLabel, keepSeparators, keptOrder } from '../helpers.ts';

// The words an entry draws around its job: the action on line one and the step line under it.

describe('entry words', () => {
  it('never repeats the step line as the action', () => {
    expect(entryAction({ action: 'Evaluating fit', detail: 'Evaluating fit…' })).toBe('');
    expect(entryAction({ action: 'Evaluating fit', detail: 'evaluating fit.' })).toBe('');
    expect(
      entryAction({ action: 'Drafting the packet', detail: 'Drafting a focused cover letter' }),
    ).toBe('Drafting the packet');
    expect(entryAction({ action: '', detail: 'Waiting for your answer' })).toBe('');
  });

  it('names whose crew follow-up it is instead of an action', () => {
    expect(
      entryAction({ action: 'Follow-up for Reviewer', detail: 'Fixing', followUpFor: 'Reviewer' }),
    ).toBe('for Reviewer');
  });

  it('keeps every separator at the end of its line', () => {
    expect(keepSeparators('Waiting for your answer · slot released')).toBe(
      'Waiting for your answer · slot released',
    );
    expect(keepSeparators('Paused until you answer Writer’s question · slot released · now')).toBe(
      'Paused until you answer Writer’s question · slot released · now',
    );
    expect(keepSeparators('Scout stopped before finishing.')).toBe(
      'Scout stopped before finishing.',
    );
  });
});

describe('entry names', () => {
  const entry = (fields: Partial<LensEntry>): LensEntry => ({
    key: 'request:shorten:writer',
    state: 'held',
    tone: 'ochre',
    live: false,
    cardId: 'waypoint',
    queueId: 'job:waypoint',
    subject: 'Waypoint',
    action: 'Also shorten the closing paragraph.',
    detail: 'Paused until you answer its question',
    stamp: { word: 'on hold' },
    ...fields,
  });

  it('never doubles a request’s own closing stop with the list’s comma', () => {
    expect(entryLabel('Writer', entry({ itemKey: 'question:question-1' }))).toBe(
      'Writer, Waypoint, Also shorten the closing paragraph, on hold. Decide in Needs you',
    );
    expect(entryLabel('Writer', entry({ action: 'Is the link live?' }))).toBe(
      'Writer, Waypoint, Is the link live, on hold',
    );
    // A cut request keeps its ellipsis, which says the words go on.
    expect(entryLabel('Writer', entry({ action: 'Also shorten the clos…' }))).toBe(
      'Writer, Waypoint, Also shorten the clos…, on hold',
    );
    expect(
      groupLabel('Scout', {
        key: 'group:held:scout',
        state: 'held',
        tone: 'ochre',
        names: 'Pine, Birch, Cedar',
        action: 'Recheck the salary.',
        detail: 'All 3 are on hold in their own job queues',
        stamp: { word: 'on hold' },
        entries: [],
      }),
    ).toBe('Scout, Pine, Birch, Cedar, Recheck the salary, on hold');
    // A group of different ages says its state word with the oldest time.
    expect(
      groupLabel('Scout', {
        key: 'group:failed:scout',
        state: 'failed',
        tone: 'rose',
        names: 'Pine, Birch',
        action: 'Evaluate fit',
        detail: 'Both stopped before finishing; their job queues are paused',
        stamp: { lead: 'oldest', word: 'failed', time: '05:40 AM' },
        entries: [],
      }),
    ).toBe('Scout, Pine, Birch, Evaluate fit, oldest failed 05:40 AM');
  });
});

describe('the lens order', () => {
  const lensRow = (roleId: string, idle = false): LensRow => ({
    roleId,
    name: roleId,
    meta: '',
    pebble: undefined,
    live: false,
    items: [],
    idle,
    urgency: Infinity,
  });
  const ids = (rows: readonly LensRow[]) => rows.map((row) => row.roleId);

  it('keeps the rows where they were when the lens opened, whatever becomes urgent later', () => {
    const rows = ['scout', 'writer', 'reviewer', 'submitter'].map((id) => lensRow(id));
    expect(ids(keptOrder(['submitter', 'scout', 'writer', 'reviewer'], rows))).toEqual([
      'submitter',
      'scout',
      'writer',
      'reviewer',
    ]);
  });

  it('adds agents that get busy later after the rest, in roster order, and drops idle ones', () => {
    const rows = [
      lensRow('scout'),
      lensRow('writer', true),
      lensRow('tracker'),
      lensRow('reviewer'),
      lensRow('submitter'),
    ];
    expect(ids(keptOrder(['submitter', 'writer', 'reviewer'], rows))).toEqual([
      'submitter',
      'reviewer',
      'scout',
      'tracker',
    ]);
  });
});
