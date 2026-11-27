import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Snapshot } from '@pitchcrew/core';
import { attentionCounts, attentionItems } from '../src/lib/attention.ts';
import { cleanup, setup } from './helpers/daemon.ts';
import { seedAttention, type AttentionFixture } from './fixtures/attention.ts';

// Locks Home's shared cast before other suites depend on it. No browser: the daemon's own
// workspace snapshot, read the way the UI reads it.
let host: Awaited<ReturnType<typeof setup>>;
let fixture: AttentionFixture;

beforeAll(async () => {
  host = await setup();
  fixture = await seedAttention(host.daemon.service);
  // Let the scheduler drain at least once (it ticks every second): a queue that turns blocked
  // after seeding means the fixture is wrong.
  await new Promise((resolve) => setTimeout(resolve, 1500));
}, 60000);
afterAll(async () => {
  await cleanup();
});

const snapshot = async () => (await host.request<Snapshot>('/snapshot?view=workspace')).result;

test('fills five of five slots and blocks no queue', async () => {
  const data = await snapshot();
  expect(data.queue).toMatchObject({ concurrency: 5, active: 5 });
  const states = Object.fromEntries(data.queue!.queues.map((queue) => [queue.cardId, queue.state]));
  const { cards } = fixture;
  expect(states).toEqual({
    [cards.halcyon]: 'running',
    [cards.initech]: 'running',
    [cards.acme]: 'running',
    [cards.lumen]: 'running',
    [cards.globex]: 'running',
    [cards.umbra]: 'waiting',
    [cards.corvid]: 'paused',
    [cards.northwind]: 'ready',
    [cards.kestrel]: 'ready',
    [cards.tidepool]: 'ready',
  });
  // Up next keeps the order the fits were queued in.
  expect(
    data.queue!.queues.filter((queue) => queue.state === 'ready').map((queue) => queue.cardId),
  ).toEqual([cards.northwind, cards.kestrel, cards.tidepool]);
});

test('leaves exactly the six seeded asks', async () => {
  const data = await snapshot();
  const items = attentionItems(data);
  expect(items.map((item) => item.key).toSorted()).toEqual(
    [
      `browser:${fixture.approvalId}`,
      `question:${fixture.questionId}`,
      `failure:${fixture.failedQueueId}`,
      `tracking:${fixture.signalId}`,
      `brief:${fixture.cards.quill}`,
      `role-proposal:${fixture.proposalId}`,
    ].toSorted(),
  );
  expect(attentionCounts(items)).toMatchObject({ home: 6, crew: 1, profile: 0, failed: 1 });
  expect(items.find((item) => item.kind === 'browser')).toMatchObject({
    cardId: fixture.cards.initech,
    roleId: 'submitter',
    holdsSlot: true,
    tier: 1,
  });
  expect(items.find((item) => item.kind === 'tracking')?.cardId).toBe(fixture.cards.bluefin);
});

test('records the follow-up, the waiting run and the failed request it reports', async () => {
  const data = await snapshot();
  expect(data.tasks.find((task) => task.id === fixture.taskId)).toMatchObject({
    status: 'running',
    runId: fixture.runs.globex,
    parentRunId: fixture.runs.globexReview,
  });
  expect(data.runs.find((run) => run.id === fixture.runs.umbra)?.status).toBe('waiting');
  expect(
    data.computerApprovals.find((item) => item.id === fixture.approvalId)?.page.screenshot,
  ).toMatch(/^\/9j\//);
  const corvid = data.queue!.queues.find((queue) => queue.id === fixture.failedQueueId);
  expect(corvid).toMatchObject({ paused: true, pauseKind: 'failed' });
  expect(corvid?.requests.map((request) => request.id)).toEqual([fixture.failedRequestId]);
  expect(fixture.fitRequestIds).toHaveLength(3);
});
