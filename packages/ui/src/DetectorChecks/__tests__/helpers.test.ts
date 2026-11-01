import type { Card, DetectorAdvisory } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { configuredProviders, detectorRows, revisionDraft, scoreLabel } from '../helpers.ts';

const advisory = (extra: Partial<DetectorAdvisory> = {}): DetectorAdvisory => ({
  id: 'a1',
  provider: 'sapling',
  document: 'coverLetter',
  documentDigest: 'digest-current',
  checkedAt: '2026-11-01T10:00:00Z',
  score: 0.8,
  confidence: 'normal',
  passages: [{ start: 0, end: 11, score: 0.9 }],
  ...extra,
});
const card = (extra: Partial<Card> = {}) =>
  ({
    id: 'job',
    packet: {
      resume: 'r',
      coverLetter: 'Dear team, I am excited.',
      formAnswers: '',
      note: '',
      claims: [],
    },
    ...extra,
  }) as Card;

describe('detector rows', () => {
  it('lists only non-empty eligible documents and marks results whose digest no longer matches', () => {
    const rows = detectorRows(
      card({
        detectorAdvisories: [
          advisory(),
          advisory({ id: 'a2', provider: 'gptzero', documentDigest: 'old' }),
        ],
      }),
      { coverLetter: 'digest-current', formAnswers: 'x' },
    );
    expect(rows.map((row) => row.document)).toEqual(['coverLetter']);
    expect(rows[0].advisories.map((item) => [item.advisory.id, item.outdated, item.tone])).toEqual([
      ['a1', false, 'flagged'],
      ['a2', true, 'flagged'],
    ]);
    expect(detectorRows(card({ packet: null }), {})).toEqual([]);
  });
  it('labels low confidence and clear results without a verdict', () => {
    const rows = detectorRows(
      card({
        detectorAdvisories: [
          advisory({ confidence: 'low', score: 0.6 }),
          advisory({ id: 'a3', provider: 'copyleaks', score: 0.1 }),
        ],
      }),
      {},
    );
    expect(rows[0].advisories.map(scoreLabel)).toEqual([
      'Sapling: low confidence, 60% flagged',
      'Copyleaks: 10% flagged',
    ]);
    expect(scoreLabel({ ...rows[0].advisories[1], outdated: true })).toBe(
      'Copyleaks: 10% flagged (outdated)',
    );
  });
  it('builds a revision draft that quotes flagged passages and opens with the learning-excluded prefix', () => {
    const [row] = detectorRows(card({ detectorAdvisories: [advisory()] }), {});
    const draft = revisionDraft(row.advisories[0], row.label, row.text);
    expect(
      draft.startsWith(
        'Revise for the AI-text detector advisory on the cover letter: Sapling flagged 80%',
      ),
    ).toBe(true);
    expect(draft).toContain('> Dear team,');
    expect(draft).toContain('do not invent motivations');
  });
  it('lists configured providers only', () => {
    expect(
      configuredProviders([
        { provider: 'sapling', configured: true },
        { provider: 'gptzero', configured: false },
      ]),
    ).toEqual(['sapling']);
    expect(configuredProviders(undefined)).toEqual([]);
  });
});
