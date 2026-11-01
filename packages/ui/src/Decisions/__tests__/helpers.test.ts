import type { Approval, Card, PacketArtifact } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import {
  briefAnswersNeeded,
  exportChoice,
  jobTimeline,
  packetChecks,
  stepDate,
  trackDates,
} from '../helpers.ts';

const card = (state: Card['state'], extra: Partial<Card> = {}) =>
  ({ id: 'job', state, createdAt: '2026-10-19T09:00:00Z', ...extra }) as Card;
const artifact = (name: PacketArtifact['name'], layout?: PacketArtifact['layout']) =>
  ({
    name,
    layout,
    mimeType: name.endsWith('.pdf') ? 'application/pdf' : 'application/docx',
  }) as PacketArtifact;

describe('jobTimeline', () => {
  it('dates each step from the first saved move into it and counts drafts', () => {
    const steps = jobTimeline(card('awaiting_approval'), [
      { id: 1, at: '2026-10-20T09:00:00Z', actor: 'user', state: 'shortlisted' },
      { id: 2, at: '2026-10-21T09:00:00Z', actor: 'writer', state: 'drafting' },
      { id: 3, at: '2026-10-21T10:00:00Z', actor: 'writer', packet: 'drafted' },
      { id: 4, at: '2026-10-22T10:00:00Z', actor: 'writer', packet: 'revised' },
      { id: 5, at: '2026-10-23T10:00:00Z', actor: 'reviewer', state: 'agreed' },
    ]);
    expect(steps.map((step) => [step.label, step.bead, step.at])).toEqual([
      ['Lead', 'done', '2026-10-19T09:00:00Z'],
      ['Shortlisted', 'done', '2026-10-20T09:00:00Z'],
      ['Drafted, 2 drafts', 'done', '2026-10-21T09:00:00Z'],
      ['Review', 'done', undefined],
      ['You approve', 'current', '2026-10-23T10:00:00Z'],
      ['Applied', 'todo', undefined],
    ]);
  });

  it('keeps only the creation date before history loads', () => {
    expect(jobTimeline(card('lead'), undefined).filter((step) => step.at)).toHaveLength(1);
  });
});

describe('trackDates', () => {
  const now = new Date(2026, 9, 31, 15, 0);
  const at = (day: number, hour: number, minute = 0) =>
    new Date(2026, 9, day, hour, minute).toISOString();

  it('prints the day once when every saved stamp shares a minute', () => {
    expect(trackDates([at(31, 0, 45), at(31, 0, 45), undefined, at(31, 0, 45)], now)).toEqual({
      shared: 'Today',
      dates: [undefined, undefined, undefined, undefined],
    });
    expect(trackDates([at(30, 9), at(30, 9)], now).shared).toBe('Yesterday');
  });

  it('uses short relative dates for a real sequence', () => {
    expect(trackDates([at(19, 9), at(31, 12), at(31, 14, 48), undefined], now)).toEqual({
      dates: [stepDate(at(19, 9), now), '3h ago', '12m ago', undefined],
    });
    expect(stepDate(at(31, 15), now)).toBe('now');
    expect(stepDate(at(19, 9), now)).not.toMatch(/ago|now/);
  });
});

describe('packetChecks', () => {
  it('shows only checks that ran on the frozen files', () => {
    expect(
      packetChecks({ documentVerification: [] } as unknown as Approval, card('agreed')),
    ).toEqual([]);
    const checks = packetChecks(
      {
        artifacts: [artifact('resume.pdf')],
        documentVerification: [
          { name: 'resume.pdf', status: 'verified', findings: [] },
          {
            name: 'cover_letter.pdf',
            status: 'blocked',
            findings: [{ severity: 'error', check: 'render', message: 'Missing glyph' }],
          },
        ],
      } as unknown as Approval,
      card('awaiting_approval'),
    );
    expect(checks).toEqual([
      { label: '1 of 2 documents readable', ok: false },
      { label: '1 document error', ok: false },
    ]);
  });
});

describe('exportChoice', () => {
  it('reads the formats and layout frozen into the approval', () => {
    expect(exportChoice({ artifacts: [] } as unknown as Approval)).toEqual({
      formats: ['Markdown'],
      layout: undefined,
    });
    expect(
      exportChoice({
        artifacts: [artifact('resume.pdf', 'plain'), artifact('resume.docx', 'plain')],
      } as unknown as Approval),
    ).toEqual({ formats: ['PDF', 'DOCX', 'Markdown'], layout: 'Plain text' });
  });
});

it('counts required personal answers still empty', () => {
  const requirements = [
    { required: true, personal: true, answer: '' },
    { required: true, personal: true, answer: 'Yes' },
    { required: false, personal: true, answer: '' },
  ];
  expect(briefAnswersNeeded({ applicationContext: { requirements } } as unknown as Card)).toBe(1);
});
