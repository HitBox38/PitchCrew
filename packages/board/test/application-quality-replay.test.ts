import { expect, it } from 'vitest';
import {
  currentEventVersion,
  decodeEvent,
  type WritingGuide,
  type WorkQueue,
  type CareerPlan,
  type WritingCorrection,
} from '@pitchcrew/core';
import { Board } from '../src/index.ts';

it('replays v24 queues and prerelease quality records together, then appends v25 without rewriting history', () => {
  const board = new Board(':memory:');
  try {
    const now = new Date().toISOString();
    const guide: WritingGuide = {
      id: 'writing-guide',
      revision: 1,
      automatic: true,
      learningSince: now,
      preferences: [],
      proposals: [],
    };
    const queue: WorkQueue = {
      id: 'job:fixture',
      cardId: 'fixture',
      threadId: 'fixture-thread',
      paused: true,
      reason: 'User paused',
      order: 1,
      updatedAt: now,
    };
    const plan: CareerPlan = {
      id: 'fixture-plan',
      revision: 1,
      name: 'Target roles',
      scope: { cardIds: ['fixture'], tag: '', title: '' },
      gaps: [],
      coverage: 'Not analyzed',
      sourceRevision: '',
      updatedAt: now,
    };
    const correction: WritingCorrection = {
      id: 'fixture-correction',
      cardId: 'fixture',
      threadId: 'fixture-thread',
      messageId: 'fixture-message',
      instruction: 'Shorten the opening',
      preference: 'Concise openings',
      scope: 'resume',
      packetDigest: 'fixture',
      before: { resume: 'Long opening', coverLetter: 'Letter' },
      after: { resume: 'Short opening', coverLetter: 'Letter' },
      retired: false,
      eligible: true,
      createdAt: now,
    };
    const fixtures = [
      ['work_queue', queue],
      ['writing_guide', guide],
      ['career_plan', plan],
      ['writing_correction', correction],
    ] as const;
    for (const [kind, data] of fixtures) {
      const raw = JSON.stringify({
        version: 24,
        kind,
        entityId: data.id,
        data,
        actor: 'user',
        message: 'Fictional historical record',
        createdAt: now,
      });
      board.db.prepare('INSERT INTO events(json) VALUES (?)').run(raw);
    }
    const historical = board.db.prepare('SELECT id,json FROM events ORDER BY id').all() as {
      id: number;
      json: string;
    }[];
    for (const record of historical) expect(decodeEvent(record.json).version).toBe(24);
    board.rebuild();
    for (const [kind, data] of fixtures) expect(board.get(kind, data.id)).toEqual(data);
    board.record(
      'writing_guide',
      { ...guide, revision: 2, automatic: false },
      'user',
      'Disable learning',
    );
    expect(currentEventVersion).toBe(29);
    expect(board.events()[0].version).toBe(currentEventVersion);
    board.rebuild();
    expect(board.get<WritingGuide>('writing_guide', guide.id).automatic).toBe(false);
    expect(board.get<WorkQueue>('work_queue', queue.id).paused).toBe(true);
    for (const record of historical)
      expect(
        (board.db.prepare('SELECT json FROM events WHERE id=?').get(record.id) as { json: string })
          .json,
      ).toBe(record.json);
  } finally {
    board.close();
  }
});
