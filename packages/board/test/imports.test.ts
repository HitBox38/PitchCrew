import {
  cardInput,
  parseApplicationImport,
  planImportRow,
  applicationImportRow,
  type ApplicationImportReport,
  type Card,
  type TrackingSignal,
} from '@pitchcrew/core';
import { afterEach, describe, expect, it } from 'vitest';
import {
  Board,
  applyApplicationImport,
  latestTrackingTime,
  previewApplicationImport,
  registerExternalApplication,
  trackingConflict,
} from '../src/index.ts';

const boards: Board[] = [];
afterEach(() => {
  for (const board of boards.splice(0)) board.close();
});
function fresh() {
  const board = new Board(':memory:');
  boards.push(board);
  return board;
}
const rows = [
  {
    company: 'Fictional Labs',
    title: 'Frontend Engineer',
    state: 'rejected',
    submittedAt: '2025-01-02T09:00:00+02:00',
    history: [
      { state: 'draft', at: '2025-01-01T08:00:00Z' },
      { state: 'submitted', at: '2025-01-02T07:00:00Z' },
      { state: 'ghosted', at: '2025-02-01T00:00:00Z', note: 'No reply for four weeks.' },
      { state: 'rejected', at: '2025-02-10T00:00:00Z' },
    ],
    tags: ['remote'],
    notes: 'Referred by a fictional friend.',
    weight: 2,
    lessons: 'Lead with the design system work.',
  },
  {
    company: 'Example Works',
    title: 'Platform Engineer',
    url: 'https://jobs.example.com/platform?utm_source=board',
    state: 'offer',
    submittedAt: '2025-03-01',
  },
  { company: 'Sample Co', title: 'Data Analyst', state: 'draft' },
  { company: 'Sample Co', title: 'Data Analyst', attempt: 2, state: 'ready' },
];
const json = (value: unknown) => ({ format: 'json', content: JSON.stringify(value) });
function apply(board: Board, request: { format: string; content: string }) {
  const preview = previewApplicationImport(board, request);
  return {
    preview,
    result: applyApplicationImport(board, { ...request, digest: preview.digest }),
  };
}
const byRow = (report: ApplicationImportReport, row: number) =>
  report.rows.find((value) => value.row === row)!;

describe('application import parsing', () => {
  it('parses JSON and CSV into the same rows, including quoted cells and history', () => {
    const csv = [
      'company,title,state,submittedAt,history,tags,notes,attempt,weight',
      '"Fictional Labs","Engineer, Platform",screening,2025-01-02T09:00:00Z,"submitted@2025-01-02T09:00:00Z; screening@2025-01-09T10:00:00Z",remote;senior,"Line one',
      'line ""two""",2,-1',
      '',
    ].join('\r\n');
    const [row] = parseApplicationImport('csv', csv);
    expect(row.error).toBeUndefined();
    expect(row.data).toMatchObject({
      company: 'Fictional Labs',
      title: 'Engineer, Platform',
      state: 'screening',
      attempt: 2,
      weight: -1,
      tags: ['remote', 'senior'],
      notes: 'Line one\r\nline "two"',
      history: [
        { state: 'submitted', at: '2025-01-02T09:00:00.000Z' },
        { state: 'screening', at: '2025-01-09T10:00:00.000Z' },
      ],
    });
    const [same] = parseApplicationImport(
      'json',
      JSON.stringify([
        {
          company: 'Fictional Labs',
          title: 'Engineer, Platform',
          state: 'screening',
          submittedAt: '2025-01-02T11:00:00+02:00',
          history: row.data!.history,
          tags: ['remote', 'senior'],
          notes: 'Line one\r\nline "two"',
          attempt: 2,
          weight: -1,
        },
      ]),
    );
    expect(same.data).toEqual(row.data);
  });
  it('reports file errors and per-row validation errors', () => {
    expect(() => parseApplicationImport('json', '{')).toThrow('not valid JSON');
    expect(() => parseApplicationImport('json', '{}')).toThrow('array');
    expect(() => parseApplicationImport('json', '[]')).toThrow('no applications');
    expect(() => parseApplicationImport('csv', 'company,stage\nA,lead')).toThrow(
      'Unknown CSV column: stage',
    );
    expect(() => parseApplicationImport('csv', 'company,title\nA,B')).toThrow('state column');
    expect(() => parseApplicationImport('csv', 'company,state\n"A,lead')).toThrow('unclosed');
    const many = Array.from({ length: 1001 }, () => ({ company: 'A', state: 'lead' }));
    expect(() => parseApplicationImport('json', JSON.stringify(many))).toThrow('at most 1000');
    const parsed = parseApplicationImport(
      'json',
      JSON.stringify([
        { company: '', state: 'lead' },
        { company: 'A', state: 'hired' },
        { company: 'A', state: 'submitted', submittedAt: '2025-01-02 09:00' },
        { company: 'A', state: 'lead', weight: 5 },
        { company: 'A', state: 'lead', url: 'ftp://example.com/job' },
        { company: 'A', state: 'lead', unknown: true },
      ]),
    );
    expect(parsed.map((row) => row.error?.split(':')[0])).toEqual([
      'company',
      'state',
      'submittedAt',
      'weight',
      'url',
      'row',
    ]);
    const extra = parseApplicationImport('csv', 'company,state\nA,lead,extra');
    expect(extra[0].error).toContain('header has 2 columns');
  });
});

describe('application import state mapping', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  const plan = (row: unknown) => planImportRow(applicationImportRow.parse(row), now);
  it('maps never-submitted rows to leads without packets and keeps legacy fields in the note', () => {
    const draft = plan({
      company: 'Sample Co',
      title: '',
      state: 'draft',
      weight: 1,
      lessons: 'Be brief.',
    });
    expect(draft).toMatchObject({ start: 'lead', state: 'lead', steps: [], submittedAt: null });
    expect(draft.input.title).toBe('Untitled role');
    expect(draft.note).toContain('Legacy lessons: Be brief.');
    expect(draft.note).toContain('Legacy weight: 1');
    expect(draft.warnings.join(' ')).toContain('Untitled role');
    expect(draft.warnings.join(' ')).toContain('weight and lessons');
    const withdrawn = plan({
      company: 'Sample Co',
      title: 'Analyst',
      state: 'withdrawn',
      history: [{ state: 'withdrawn', at: '2025-05-01T00:00:00Z' }],
    });
    expect(withdrawn.steps).toEqual([{ state: 'withdrawn', at: '2025-05-01T00:00:00.000Z' }]);
    expect(() =>
      plan({ company: 'A', title: 'B', state: 'draft', submittedAt: '2025-01-01' }),
    ).toThrow('before submission');
  });
  it('follows valid history with its effective times and completes it to the final state', () => {
    const result = plan({
      company: 'A',
      title: 'B',
      state: 'offer',
      history: [
        { state: 'submitted', at: '2025-01-01T00:00:00Z' },
        { state: 'screening', at: '2025-01-05T00:00:00Z' },
      ],
      statusAt: '2025-02-01T00:00:00Z',
    });
    expect(result.submittedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(result.steps).toEqual([
      { state: 'screening', at: '2025-01-05T00:00:00.000Z' },
      { state: 'interviewing', at: '2025-01-05T00:00:00.000Z' },
      { state: 'offer', at: '2025-02-01T00:00:00.000Z' },
    ]);
    expect(result.warnings.join(' ')).toContain('Added interviewing to reach offer');
    expect(result.note).not.toContain('Legacy history');
  });
  it('takes the shortest valid path for disallowed legacy sequences and keeps the history text', () => {
    const result = plan({
      company: 'A',
      title: 'B',
      state: 'rejected',
      submittedAt: '2025-01-01T00:00:00Z',
      history: [
        { state: 'ghosted', at: '2025-02-01T00:00:00Z' },
        { state: 'rejected', at: '2025-03-01T00:00:00Z', note: 'Late reply.' },
      ],
    });
    expect(result.steps).toEqual([{ state: 'rejected', at: '2025-03-01T00:00:00.000Z' }]);
    expect(result.note).toContain('Legacy history:\n- ghosted at 2025-02-01T00:00:00.000Z');
    expect(result.note).toContain('- rejected at 2025-03-01T00:00:00.000Z: Late reply.');
    expect(result.warnings.join(' ')).toContain('shortest valid path');
  });
  it('keeps effective times monotonic, rejects future dates and requires a submission date', () => {
    const result = plan({
      company: 'A',
      title: 'B',
      state: 'interviewing',
      submittedAt: '2025-03-01T00:00:00Z',
      history: [{ state: 'interviewing', at: '2025-02-01T00:00:00Z' }],
    });
    expect(result.steps).toEqual([{ state: 'interviewing', at: '2025-03-01T00:00:00.000Z' }]);
    expect(result.warnings.join(' ')).toContain('earlier than the step before');
    expect(() =>
      plan({ company: 'A', title: 'B', state: 'submitted', submittedAt: '2027-01-01' }),
    ).toThrow('future');
    expect(() => plan({ company: 'A', title: 'B', state: 'rejected' })).toThrow('submittedAt');
  });
  it('separates tries, shortens tags and caps notes', () => {
    const result = plan({
      company: 'A',
      title: 'B',
      attempt: 3,
      state: 'lead',
      tags: [...Array.from({ length: 12 }, (_, i) => `tag-${i}`), 'x'.repeat(50), 'TAG-0'],
      notes: 'n'.repeat(4000),
      lessons: 'l'.repeat(2000),
      history: [{ state: 'lead', at: '2025-01-01', note: 'h'.repeat(1000) }],
    });
    expect(result.input.title).toBe('B (try 3)');
    expect(result.input.tags).toHaveLength(10);
    expect(result.warnings.join(' ')).toContain('dropped tag-10, tag-11, xxxx');
    expect(result.note).toHaveLength(6000);
    expect(result.warnings.join(' ')).toContain('Shortened the note');
  });
});

describe('application import on the board', () => {
  it('previews new, duplicate and invalid rows without changing the board', () => {
    const board = fresh();
    const existing = registerExternalApplication(board, {
      company: 'example works',
      title: 'PLATFORM ENGINEER',
      url: 'https://jobs.example.com/platform',
      submittedAt: '2025-03-01T00:00:00Z',
      note: 'Registered earlier.',
    });
    const before = board.events(1000).length;
    const preview = previewApplicationImport(
      board,
      json([...rows, rows[2], { company: 'Bad', state: 'nope' }]),
    );
    expect(board.events(1000)).toHaveLength(before);
    expect(preview.rows.map((row) => row.status)).toEqual([
      'new',
      'duplicate',
      'new',
      'new',
      'duplicate',
      'invalid',
    ]);
    expect(byRow(preview, 2).cardIds).toEqual([existing.id]);
    expect(byRow(preview, 5).reason).toBe('Same as row 3.');
    expect(byRow(preview, 6).reason).toContain('state');
    expect(byRow(preview, 1).path).toEqual(['submitted', 'rejected']);
    expect(preview.counts).toMatchObject({ new: 3, duplicate: 2, invalid: 1 });
  });
  it('applies rows through external registration with effective times and is safe to retry', () => {
    const board = fresh();
    const { result } = apply(board, json(rows));
    expect(result.counts).toMatchObject({ created: 4, failed: 0 });
    const cards = board.list<Card>('card');
    const rejected = cards.find((card) => card.company === 'Fictional Labs')!;
    expect(rejected).toMatchObject({
      state: 'rejected',
      packet: null,
      sample: false,
      statusEffectiveAt: '2025-02-10T00:00:00.000Z',
      tracking: { origin: 'external', submittedAt: '2025-01-02T07:00:00.000Z' },
    });
    expect(rejected.tracking!.note).toContain('Referred by a fictional friend.');
    expect(rejected.tracking!.note).toContain('Legacy weight: 2');
    expect(rejected.tracking!.note).toContain('No reply for four weeks.');
    const offer = cards.find((card) => card.company === 'Example Works')!;
    expect(offer.state).toBe('offer');
    const states = board
      .history(offer.id, undefined, 50)
      .map((event) => (event.data as Card).state)
      .reverse();
    expect(states).toEqual(['lead', 'submitted', 'interviewing', 'offer']);
    const leads = cards.filter((card) => card.company === 'Sample Co');
    expect(leads.map((card) => [card.title, card.state, card.tracking?.origin])).toEqual([
      ['Data Analyst', 'lead', 'pitchcrew'],
      ['Data Analyst (try 2)', 'lead', 'pitchcrew'],
    ]);
    // Later evidence older than an imported outcome is rejected as usual.
    expect(latestTrackingTime(board, rejected)).toBe(Date.parse('2025-02-10T00:00:00Z'));
    const older = { state: 'rejected', effectiveAt: '2025-02-01T00:00:00Z' } as TrackingSignal;
    expect(trackingConflict(board, older, rejected)).toContain('Older');

    const events = board.events(1000).length;
    const retry = apply(board, json(rows));
    expect(retry.preview.counts).toMatchObject({ imported: 4, new: 0 });
    expect(retry.result.counts).toMatchObject({ imported: 4, created: 0 });
    expect(byRow(retry.result, 1).cardIds).toEqual([rejected.id]);
    expect(board.events(1000)).toHaveLength(events);
    const edited = apply(board, json([{ ...rows[0], notes: 'Changed note.' }]));
    expect(edited.result.rows[0]).toMatchObject({ status: 'duplicate', cardIds: [rejected.id] });
    board.rebuild();
    expect(board.list<Card>('card')).toEqual(cards);
  });
  it('rejects a changed file, oversized content and an invalid digest', () => {
    const board = fresh();
    const preview = previewApplicationImport(board, json(rows));
    expect(() =>
      applyApplicationImport(board, { ...json(rows.slice(1)), digest: preview.digest }),
    ).toThrow('changed after the preview');
    expect(() => applyApplicationImport(board, json(rows))).toThrow();
    expect(() =>
      previewApplicationImport(board, { format: 'csv', content: 'x'.repeat(2 * 1024 * 1024 + 1) }),
    ).toThrow('at most 2 MB');
    expect(board.list('card')).toEqual([]);
  });
  it('creates cards that existing duplicate detection recognizes', () => {
    const board = fresh();
    apply(board, json([rows[1]]));
    expect(() =>
      registerExternalApplication(board, {
        ...cardInput.parse({ company: 'Example Works', title: 'Platform Engineer' }),
        submittedAt: '2025-03-01T00:00:00Z',
        note: 'Again.',
      }),
    ).toThrow('already tracked');
  });
});
