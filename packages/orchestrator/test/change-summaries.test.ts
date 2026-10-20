import type { Card, Role, Snapshot } from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import { packet } from '../../board/test/fixtures/packet.ts';
import { cleanup, confirmFixtureApplication, setup } from './helpers/daemon.ts';

afterEach(cleanup);

it('keeps each applied agent change description in job activity through replay', async () => {
  const { daemon, request } = await setup(19911);
  const { service } = daemon;
  const card = service.createCard({ company: 'Fictional Activity', title: 'Engineer' });
  await confirmFixtureApplication(request, card.id);
  const role = (id: string) => service.board.get<Role>('role', id);
  const profile = [{ name: 'profile.md', content: 'Built React interfaces.' }];
  await service.applyResult(card.id, role('scout'), {
    role: 'scout',
    fit: 82,
    reasons: ['Relevant interface experience.'],
    changeSummary: 'Set fit to 82/100 based on interface experience.',
  });
  service.moveCard(card.id, 'shortlisted');
  service.board.move(card.id, 'drafting', 'orchestrator');
  await service.applyResult(
    card.id,
    role('writer'),
    {
      role: 'writer',
      packet,
      changeSummary: 'Tailored the resume to the React role.',
    },
    profile,
  );
  await service.applyResult(
    card.id,
    role('reviewer'),
    {
      role: 'reviewer',
      passed: false,
      feedback: ['Clarify the introduction.'],
      changeSummary: 'Requested a clearer resume introduction.',
    },
    profile,
  );
  const revised = { ...packet, resume: `${packet.resume}\n\n## Experience` };
  service.board.move(card.id, 'drafting', 'orchestrator');
  await service.applyResult(
    card.id,
    role('writer'),
    {
      role: 'writer',
      packet: revised,
      changeSummary: 'Clarified the introduction.\n\tKept the verified claims.',
    },
    profile,
  );
  await service.applyResult(
    card.id,
    role('reviewer'),
    {
      role: 'reviewer',
      passed: true,
      feedback: [],
      changeSummary: 'Verified the revised introduction against the profile.',
    },
    profile,
  );
  service.board.rebuild();
  const snapshot = (await request<Snapshot>('/snapshot')).result;
  const changes = snapshot.events.filter((event) => event.entityId === card.id);
  expect(
    changes
      .filter((event) => event.message.startsWith('Drafted application packet:'))
      .map((event) => [event.actor, event.message]),
  ).toEqual([
    ['writer', 'Drafted application packet: Clarified the introduction. Kept the verified claims.'],
    ['writer', 'Drafted application packet: Tailored the resume to the React role.'],
  ]);
  expect(changes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        actor: 'scout',
        message: expect.stringContaining('Set fit to 82/100'),
      }),
      expect.objectContaining({
        actor: 'reviewer',
        message: 'Reviewer requested changes: Requested a clearer resume introduction.',
      }),
      expect.objectContaining({
        actor: 'reviewer',
        message:
          'Reviewer approved the packet: Verified the revised introduction against the profile.',
      }),
    ]),
  );
  expect(service.board.get<Card>('card', card.id).state).toBe('agreed');
});

it('records factual summaries for older results and never logs rejected packet writes', async () => {
  const { daemon, request } = await setup(19912);
  const { service } = daemon;
  const card = service.createCard({ company: 'Fictional Legacy', title: 'Engineer' });
  await confirmFixtureApplication(request, card.id);
  const writer = service.board.get<Role>('role', 'writer');
  const profile = [{ name: 'profile.md', content: 'Built React interfaces.' }];
  await service.applyResult(card.id, service.board.get<Role>('role', 'scout'), {
    role: 'scout',
    fit: 70,
    reasons: ['Relevant\nexperience.'],
  });
  expect(service.board.history(card.id)[0].message).toBe(
    'Evaluated job fit: Set fit score to 70/100; Relevant experience.',
  );
  service.moveCard(card.id, 'shortlisted');
  service.board.move(card.id, 'drafting', 'orchestrator');
  await service.applyResult(card.id, writer, { role: 'writer', packet }, profile);
  service.board.move(card.id, 'changes_requested', 'reviewer');
  service.board.move(card.id, 'drafting', 'orchestrator');
  await service.applyResult(
    card.id,
    writer,
    {
      role: 'writer',
      packet: { ...packet, note: 'Revised note.' },
    },
    profile,
  );
  expect(
    service.board
      .history(card.id)
      .some((event) => event.message === 'Drafted application packet: Updated application note'),
  ).toBe(true);
  const before = service.board.events();
  await expect(
    service.applyResult(
      card.id,
      writer,
      {
        role: 'writer',
        packet,
        changeSummary: 'Claimed an unsupported rewrite.',
      },
      [],
    ),
  ).rejects.toThrow();
  expect(service.board.events()).toEqual(before);
  service.packetRules.save({
    version: 1,
    rules: [
      { id: 'short-resume', kind: 'word_limit', severity: 'error', documents: ['resume'], max: 1 },
    ],
  });
  await service.applyResult(
    card.id,
    service.board.get<Role>('role', 'reviewer'),
    {
      role: 'reviewer',
      passed: true,
      feedback: [],
      changeSummary: 'Approved every packet check.',
    },
    profile,
  );
  const review = service.board
    .history(card.id)
    .find((event) => event.message.startsWith('Reviewer requested changes:'))!;
  expect(review.message).toBe('Reviewer requested changes: Resume exceeds 1 words.');
  expect(review.message).not.toContain('Approved every packet check');
});
