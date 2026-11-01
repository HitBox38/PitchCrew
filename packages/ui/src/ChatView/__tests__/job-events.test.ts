import type { Approval, BoardEvent, Card } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { jobEvents, placeJobEvents } from '../job-events.ts';
import { jobHeadingMeta } from '../presentation.ts';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 30, 10, minute)).toISOString();
const card = (patch: Partial<Card> = {}) =>
  ({
    id: 'card-1',
    company: 'Northstar',
    title: 'Frontend Tech Lead',
    location: 'Remote, EU',
    state: 'lead',
    fit: 82,
    packet: null,
    createdAt: at(0),
    updatedAt: at(0),
    ...patch,
  }) as Card;
const event = (id: number, minute: number, data: Card, message = 'Updated'): BoardEvent =>
  ({
    id,
    version: 32,
    kind: 'card',
    entityId: data.id,
    actor: 'scout',
    message,
    data,
    createdAt: at(minute),
  }) as BoardEvent;
const packet = (resume: string) =>
  ({ resume, coverLetter: 'Letter', formAnswers: '', note: '', claims: [] }) as never;

describe('jobEvents', () => {
  it('reads status moves, drafts and saved milestones in time order', () => {
    const events = [
      event(1, 1, card(), 'Added Northstar to the board'),
      event(2, 2, card({ state: 'shortlisted' }), 'User changed status to shortlisted'),
      event(3, 5, card({ state: 'in_review', packet: packet('One') }), 'Moved to in review'),
      event(4, 6, card({ state: 'in_review', packet: packet('Two') })),
      event(9, 7, { ...card(), id: 'other', state: 'offer' }, 'Moved to offer'),
    ];
    const current = card({
      state: 'in_review',
      applicationContext: { confirmedAt: at(3), revision: 'r1' } as Card['applicationContext'],
    });
    expect(jobEvents(current, [], events, at(0)).map((item) => item.label)).toEqual([
      'Shortlisted',
      'Brief confirmed by you',
      'Packet drafted',
      'In review',
      'Packet revised',
    ]);
  });

  it('keeps a first move in the window and drops what predates the conversation', () => {
    const events = [event(7, 4, card({ state: 'drafting' }), 'Moved to drafting')];
    expect(jobEvents(card({ state: 'drafting' }), [], events, at(0))[0]).toMatchObject({
      label: 'Drafting',
      tone: 'done',
      actor: 'scout',
    });
    expect(jobEvents(card({ state: 'drafting' }), [], events, at(10))).toEqual([]);
  });

  it('collapses the effective status and approval decisions', () => {
    const approval = {
      id: 'a1',
      cardId: 'card-1',
      status: 'consumed',
      createdAt: at(10),
      decidedAt: at(12),
    } as Approval;
    const current = card({
      state: 'submitted',
      statusEffectiveAt: at(20),
      tracking: { origin: 'pitchcrew', submittedAt: at(20), gmailThreads: [] },
    });
    const labels = jobEvents(current, [approval, { ...approval, cardId: 'x' }], [], at(0));
    expect(labels.map((item) => [item.label, item.tone])).toEqual([
      ['Approval requested', 'ochre'],
      ['Approved and exported', 'moss'],
      ['Submitted', 'moss'],
    ]);
  });
});

describe('placeJobEvents', () => {
  const items = [
    { id: 'm1', createdAt: at(1) },
    { id: 'turn', createdAt: at(3) },
    { id: 'reply', createdAt: at(4) },
    { id: 'm2', createdAt: at(8) },
  ];
  const events = [0, 2, 3.5, 5, 9].map((minute, index) => ({
    id: `e${index}`,
    at: new Date(Date.parse(at(0)) + minute * 60_000).toISOString(),
    label: `Event ${index}`,
  }));
  const joined = (index: number) => index === 2;

  it('hangs events after the item they follow and keeps a reply under its turn', () => {
    const placed = placeJobEvents(items, events, { oldest: true, newest: true }, joined);
    expect(placed.get('m1')?.before?.map((item) => item.id)).toEqual(['e0']);
    expect(placed.get('m1')?.after?.map((item) => item.id)).toEqual(['e1']);
    expect(placed.get('turn')).toBeUndefined();
    expect(placed.get('reply')?.after?.map((item) => item.id)).toEqual(['e2', 'e3']);
    expect(placed.get('m2')?.after?.map((item) => item.id)).toEqual(['e4']);
  });

  it('leaves the page edges to the oldest and newest pages', () => {
    const placed = placeJobEvents(items, events, { oldest: false, newest: false }, joined);
    expect(placed.get('m1')?.before).toBeUndefined();
    expect(placed.get('m2')).toBeUndefined();
    expect(placeJobEvents([], events, { oldest: true, newest: true }).size).toBe(0);
  });
});

it('describes the job under a job chat title', () => {
  expect(jobHeadingMeta({ fit: 82, location: 'Remote, EU' })).toBe('Fit 82 · Remote, EU');
  expect(jobHeadingMeta({ fit: null, location: ' ' })).toBe('');
});
