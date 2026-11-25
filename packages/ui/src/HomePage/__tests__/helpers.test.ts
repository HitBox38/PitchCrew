import { describe, expect, it } from 'vitest';
import type { Routine } from '@pitchcrew/core';
import { attentionItems, type AttentionItem, type AttentionTier } from '@/lib/attention.ts';
import { clockLabel } from '@/lib/time.ts';
import {
  ago,
  card,
  everyKind,
  everyKindRemote,
  instructionUpdate,
  now,
  question,
  run,
  snapshot,
} from '@/lib/__tests__/attention-fixture.ts';
import { busySnapshot } from '@/lib/__tests__/busy-fixture.ts';
import {
  asDecision,
  crewLine,
  deskEntries,
  deskSections,
  factParts,
  foldLabel,
  foldSummary,
  foldTierOf,
  nextOpenKey,
  openRow,
  revealOpenRow,
  rowLine,
  tierGroups,
} from '../helpers.ts';
import type { DeskEntry, DeskRecord, DeskState } from '../types.ts';

const slots = { concurrency: 5, active: 5, background: 0, queues: [] };
const entry = (tier: AttentionItem['tier'], tone: AttentionItem['tone'] = 'ochre') => ({
  tier,
  tone,
});

describe('Home title fact', () => {
  it('counts the same list as the badge, with slots once known and failures only when any', () => {
    const list = attentionItems(busySnapshot());
    expect(factParts(list, { queue: slots })).toEqual({
      needs: '20 need you',
      slots: '5 of 5 slots',
      failed: '2 failed',
    });
    expect(factParts(list.slice(0, 1), {})).toEqual({
      needs: '1 needs you',
      slots: '',
      failed: '',
    });
    expect(factParts([], { queue: { ...slots, active: 0 } })).toEqual({
      needs: 'Nothing needs you',
      slots: '0 of 5 slots',
      failed: '',
    });
  });
});

describe('Needs you rows', () => {
  it('words a closed row from the shared attention labels, with its age in the long style', () => {
    const data = snapshot({
      cards: [card('umbra', { company: 'Umbra Health', state: 'drafting' })],
      userInputs: [question('question-1')],
    });
    const [item] = attentionItems(data);
    expect(rowLine(item!, data, now)).toEqual({
      subject: 'Umbra Health',
      kind: 'Question from Writer',
      ask: 'Which project should lead the cover letter?',
      context: 'Frontend Engineer',
      age: '25 min',
      ageCue: 'waiting',
      askedAt: ago(25),
    });
    expect(rowLine({ ...item!, askedAt: '' }, data, now).age).toBe('');
    // Under a minute it was asked just now; it has not been waiting.
    expect(rowLine({ ...item!, askedAt: ago(0.5) }, data, now)).toMatchObject({
      age: 'just now',
      ageCue: 'asked',
    });
  });

  it('shows no age for a new default instruction version, whose only time is a release date', () => {
    const data = snapshot({ instructionUpdates: [instructionUpdate('scout')] });
    const [item] = attentionItems(data);
    expect(item).toMatchObject({ kind: 'instruction-update' });
    expect(item!.askedAt).toMatch(/T00:00:00\.000Z$/);
    expect(rowLine(item!, data, now).age).toBe('');
    expect(foldLabel([item!], now)).toBe('1 more · instruction update');
  });

  it('shows three entries per tier and folds the rest, except tier 1 and failed work', () => {
    const groups = tierGroups(attentionItems(busySnapshot()));
    expect(groups.map((group) => [group.tier, group.shown.length, group.folded.length])).toEqual([
      [1, 1, 0],
      [2, 4, 5],
      [4, 3, 5],
      [5, 2, 0],
    ]);
    // Corvid failed after the third entry and stays in view; the questions and a brief fold.
    expect(groups[1]!.shown.map((item) => item.key)).toEqual([
      'failure:job:keystone',
      'brief:quill-studio',
      'brief:harbor-health',
      'failure:job:corvid',
    ]);
    expect(foldLabel(groups[1]!.folded, now)).toBe('5 more · questions and job brief · oldest 1 d');
    expect(foldLabel(groups[2]!.folded, now)).toBe('5 more · tracking reviews · oldest 1 d');
    const urgent = tierGroups([1, 1, 1, 1, 1].map(() => entry(1)));
    expect(urgent[0]).toMatchObject({ tier: 1, folded: [] });
    expect(urgent[0]!.shown).toHaveLength(5);
  });

  it('groups any ranked entries by tier in tier order', () => {
    const groups = tierGroups([entry(3), entry(1), entry(3), entry(5, 'rose')]);
    expect(groups.map((group) => [group.tier, group.shown.length])).toEqual([
      [1, 1],
      [3, 2],
      [5, 1],
    ]);
  });

  it('names two kinds at most in a fold and leaves out an unknown age', () => {
    const items = attentionItems(everyKind(), { remoteRequests: everyKindRemote });
    const tier5 = items.filter((item) => item.tier === 5);
    expect(foldLabel(tier5, now)).toMatch(
      /^6 more · instruction update, writing suggestion and others · oldest \d+ [a-z]+$/,
    );
    expect(foldLabel([{ kind: 'question', askedAt: '' }], now)).toBe('1 more · question');
  });
});

describe('Desk close', () => {
  const routine = (fields: Partial<Routine>) =>
    ({
      name: 'Morning scan',
      enabled: true,
      deletedAt: null,
      nextRunAt: null,
      ...fields,
    }) as Routine;

  it('says what the crew does instead: its jobs, the next routine, or that it is idle', () => {
    const working = [
      run('a', { cardId: 'x' }),
      run('b', { cardId: 'x' }),
      run('c', { cardId: 'y' }),
    ];
    expect(crewLine({ runs: working, routines: [] }, now)).toBe('The crew is working on 2 jobs.');
    expect(crewLine({ runs: [run('chat')], routines: [] }, now)).toBe('The crew is working.');
    const reserved = run('seat', { cardId: 'x', reviewSeatReservation: true });
    const soon = new Date(now + 30 * 60_000).toISOString();
    const later = new Date(now + 24 * 3600_000).toISOString();
    const routines = [
      routine({ name: 'Paused scan', enabled: false, nextRunAt: soon }),
      routine({ name: 'Weekly review', nextRunAt: later }),
      routine({ nextRunAt: soon }),
    ];
    expect(crewLine({ runs: [reserved], routines }, now)).toBe(
      `The crew is idle until Morning scan at ${clockLabel(soon)}.`,
    );
    expect(crewLine({ runs: [], routines: routines.slice(0, 2) }, now)).toBe(
      `The crew is idle until Weekly review tomorrow at ${clockLabel(later)}.`,
    );
    expect(crewLine({ runs: [], routines: [] }, now)).toBe('The crew is idle.');
  });
});

/** A record of `item` as the desk would make it, decided at `minutes` past the fixture's now. */
const recordOf = (item: AttentionItem, seq = 1, text = 'Decided'): DeskRecord => ({
  key: item.key,
  kind: item.kind,
  tier: item.tier,
  askedAt: item.askedAt,
  expiresAt: item.expiresAt,
  queueId: item.queueId,
  tone: item.tone,
  subject: item.key,
  label: item.kind,
  text,
  bead: 'primary',
  decidedAt: new Date(now + seq * 60_000).toISOString(),
  seq,
  calls: [],
  view: { item, data: everyKind() },
});
const closed: DeskState = { openKey: null, armedAt: 0, visited: new Set(), unfolded: new Set() };

describe('The desk', () => {
  const items = attentionItems(everyKind(), { remoteRequests: everyKindRemote });

  it('sorts a record into the place its row stood, keyed apart from any live item', () => {
    const decided = items.find((item) => item.kind === 'question')!;
    const left = items.filter((item) => item !== decided);
    const entries = deskEntries(left, { [decided.key]: recordOf(decided) }, {});
    expect(entries.map((entry) => entry.key)).toEqual(
      items.map((item) =>
        item === decided ? `record:${item.key}:${new Date(now + 60_000).toISOString()}` : item.key,
      ),
    );
    const record = entries.find((entry) => entry.type === 'record');
    expect(record).toMatchObject({ tier: 2, tone: 'ochre' });
  });

  it('opens the most urgent row still waiting, never one whose call is running', () => {
    const [first, second] = items;
    const flights = { [first!.key]: { view: { item: first!, data: everyKind() }, count: 1 } };
    expect(nextOpenKey(deskEntries(items, {}, {}))).toBe(first!.key);
    expect(nextOpenKey(deskEntries(items, {}, flights))).toBe(second!.key);
    expect(nextOpenKey(deskEntries([], { [first!.key]: recordOf(first!) }, {}))).toBeNull();
  });

  it('opens a folded row’s fold first and remembers every row opened this visit', () => {
    const entries = deskEntries(attentionItems(busySnapshot()), {}, {});
    const folded = tierGroups(entries).find((group) => group.folded.length)!;
    const key = folded.folded[0]!.key;
    expect(foldTierOf(entries, key)).toBe(folded.tier);
    expect(foldTierOf(entries, entries[0]!.key)).toBeNull();
    const opened = openRow(closed, key, entries, 1234);
    expect(opened).toMatchObject({ openKey: key, armedAt: 1234 });
    expect([...opened.visited]).toEqual([key]);
    expect([...opened.unfolded]).toEqual([folded.tier]);
    const again = openRow(opened, entries[0]!.key, entries, 2000);
    expect([...again.visited]).toEqual([key, entries[0]!.key]);
    expect(openRow(again, null, entries, 3000)).toMatchObject({ openKey: null, armedAt: 3000 });
  });

  it('opens the fold an open row is ranked behind, but leaves one the user closed over it', () => {
    const live = (key: string) => ({ type: 'live', key, tier: 3, tone: 'ochre' }) as DeskEntry;
    const before = ['alder', 'birch', 'cedar', 'dogwood'].map(live);
    // Approving Alder's packet dates it by the approval, so it sorts last: past the third row.
    const after = ['birch', 'cedar', 'dogwood', 'alder'].map(live);
    const desk = openRow(closed, 'alder', before, 1);
    expect(foldTierOf(before, 'alder')).toBeNull();
    expect(foldTierOf(after, 'alder')).toBe(3);
    const shown = revealOpenRow(desk, after, null);
    expect(shown).toMatchObject({ openKey: 'alder', armedAt: 1 });
    expect([...shown.unfolded]).toEqual([3]);
    // Still in view, nothing changes; a fold the user closed over the open row stays closed.
    expect(revealOpenRow(desk, before, null)).toBe(desk);
    const closedAgain = { ...shown, unfolded: new Set<AttentionTier>() };
    expect(revealOpenRow(closedAgain, after, 3)).toBe(closedAgain);
  });

  it('captions an all-decided tier "Decided" and says how many a decided fold holds', () => {
    const tracking = items.filter((item) => item.tier === 4);
    const decided = deskEntries(
      [],
      Object.fromEntries(tracking.map((item, index) => [item.key, recordOf(item, index + 1)])),
      {},
    );
    expect(deskSections(tierGroups(decided)).map((section) => section.caption)).toEqual([
      'Decided',
    ]);
    expect(deskSections(tierGroups(deskEntries(tracking, {}, {})))[0]!.caption).toBe(
      'A record to confirm',
    );
    expect(foldSummary(decided, now)).toEqual({ label: '1 decided', waiting: false });
    expect(foldSummary(deskEntries(tracking, {}, {}), now)).toEqual({
      label: '1 more · tracking review · oldest 1 h',
      waiting: true,
    });
  });

  it('puts each run of adjacent all-decided tiers under one "Decided"; a tier still waiting keeps its own', () => {
    /** The desk's groups with the chosen items decided here, the rest still waiting. */
    const sections = (decided: (item: AttentionItem) => boolean) => {
      const done = items.filter(decided);
      const records = Object.fromEntries(
        done.map((item, index) => [item.key, recordOf(item, index + 1)]),
      );
      return deskSections(
        tierGroups(
          deskEntries(
            items.filter((item) => !decided(item)),
            records,
            {},
          ),
        ),
      );
    };
    const shape = (list: ReturnType<typeof sections>) =>
      list.map((section) => [section.caption, section.tiers.map((group) => group.tier)]);
    // Tier 3 still waits: the decided tiers above it and below it make two runs, one group each.
    expect(shape(sections((item) => item.tier !== 3))).toEqual([
      ['Decided', [1, 2]],
      ['Your move on a job', [3]],
      ['Decided', [4, 5]],
    ]);
    // The whole morning decided: one caption over every record line, the tiers in rank order.
    const done = sections(() => true);
    expect(shape(done)).toEqual([['Decided', [1, 2, 3, 4, 5]]]);
    const lines = done[0]!.tiers.flatMap((group) => [...group.shown, ...group.folded]);
    expect(lines.every((entry) => entry.type === 'record')).toBe(true);
    expect(lines).toHaveLength(items.length);
    // A record beside a live row is no run: its tier keeps the caption saying why it ranks there.
    const question = items.find((item) => item.kind === 'question')!;
    expect(shape(sections((item) => item.tier === 1 || item === question))).toEqual([
      ['Decided', [1]],
      ['Queued work waits on you', [2]],
      ['Your move on a job', [3]],
      ['A record to confirm', [4]],
      ['Changes nothing until you adopt it', [5]],
    ]);
  });

  it('keeps a failure’s record out of a fold, as the failure was', () => {
    const failure = items.find((item) => item.kind === 'failure')!;
    const [record] = deskEntries([], { [failure.key]: recordOf(failure) }, {});
    expect(record).toMatchObject({ type: 'record', tone: 'rose' });
    // Fourth in its tier, a rose record still stays in view where the failure stood.
    const groups = tierGroups([entry(2), entry(2), entry(2), record!]);
    expect(groups[0]!.shown).toContain(record);
    expect(groups[0]!.folded).toEqual([]);
  });

  it('adapts packets and briefs to the shape Decisions reads', () => {
    const packet = items.find((item) => item.kind === 'packet')!;
    expect(asDecision(packet)).toEqual({
      id: 'packet-1',
      kind: 'packet',
      cardId: 'juniper',
      roleId: null,
      threadId: null,
      detail: '',
      createdAt: packet.askedAt,
      stage: 'approve',
    });
    const brief = items.find((item) => item.kind === 'brief')!;
    expect(asDecision(brief)).toMatchObject({ id: 'brief-quill', kind: 'brief', cardId: 'quill' });
  });
});
