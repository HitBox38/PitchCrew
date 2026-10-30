import type { Card, Role } from '@pitchcrew/core';
import { digestPacket } from '@pitchcrew/board';
import { afterEach, expect, it } from 'vitest';
import { packet } from '../../board/test/fixtures/packet.ts';
import { cleanup, confirmFixtureApplication, setup } from './helpers/daemon.ts';
import { reviewSummary } from './helpers/review-summary.ts';

afterEach(cleanup);

it('binds Reviewer summaries and Writer change notes to the exact packet', async () => {
  const { daemon, request } = await setup(19931);
  const { service } = daemon;
  const card = service.createCard({ company: 'Fictional Handoff', title: 'Engineer' });
  await confirmFixtureApplication(request, card.id);
  const role = (id: string) => service.board.get<Role>('role', id);
  const profile = [{ name: 'profile.md', content: 'Built React interfaces.' }];
  const current = () => service.board.get<Card>('card', card.id);
  service.moveCard(card.id, 'shortlisted');
  service.board.move(card.id, 'drafting', 'orchestrator');
  await service.applyResult(card.id, role('writer'), { role: 'writer', packet }, profile);
  expect(current().packetChanges).toBeUndefined();
  const reviewer = role('reviewer');
  const before = service.board.events();
  await expect(
    service.applyResult(
      card.id,
      reviewer,
      { role: 'reviewer', passed: true, feedback: [] },
      profile,
    ),
  ).rejects.toThrow('without a summary');
  expect(service.board.events()).toEqual(before);
  await service.applyResult(
    card.id,
    reviewer,
    { role: 'reviewer', passed: false, feedback: ['Lead with the React work.'] },
    profile,
  );
  expect(current().state).toBe('changes_requested');
  const revised = { ...packet, note: 'Revised note.' };
  service.board.move(card.id, 'drafting', 'orchestrator');
  await service.applyResult(
    card.id,
    role('writer'),
    { role: 'writer', packet: revised, changes: ['Moved the React work to the top.'] },
    profile,
  );
  expect(current().packetChanges).toEqual({
    packetDigest: digestPacket(card.id, current().packet!),
    notes: ['Moved the React work to the top.'],
  });
  await service.applyResult(
    card.id,
    reviewer,
    { role: 'reviewer', passed: true, feedback: [], summary: reviewSummary() },
    profile,
  );
  expect(current().state).toBe('agreed');
  expect(current().packetReview).toMatchObject({
    packetDigest: digestPacket(card.id, current().packet!),
    summary: reviewSummary(),
  });
  service.board.rebuild();
  expect(current().packetReview?.summary).toEqual(reviewSummary());
  expect(current().packetChanges?.notes).toEqual(['Moved the React work to the top.']);
});
