import { expect, it } from 'vitest';
import { liveRunIndex } from '../live-runs.ts';
import { runActivityLabel } from '../work-queue.ts';
import { ago, run, snapshot } from './attention-fixture.ts';

const step = (label: string) => ({
  id: label,
  kind: 'tool' as const,
  label,
  status: 'running' as const,
  startedAt: ago(1),
  finishedAt: null,
});

it('lays the chat stream’s live runs over the saved ones', () => {
  const data = snapshot({
    runs: [
      run('drafting', { cardId: 'acme', message: 'Starting', startedAt: ago(12) }),
      run('done', { cardId: 'acme', status: 'completed', finishedAt: ago(2), startedAt: ago(30) }),
    ],
    activityRuns: [
      run('drafting', {
        cardId: 'acme',
        startedAt: ago(12),
        activity: [step('Reading the brief')],
      }),
      // The stream missed this run's last update; the saved finish wins.
      run('done', { cardId: 'acme', startedAt: ago(30), activity: [step('Checking')] }),
      run('fresh', { cardId: 'lumen', roleId: 'scout', startedAt: ago(1) }),
    ],
  });
  const { runs, byCard } = liveRunIndex(data);
  expect(runActivityLabel(runs.get('drafting')!)).toBe('Reading the brief');
  expect(runs.get('done')).toMatchObject({ status: 'completed', finishedAt: ago(2) });
  expect(runs.get('done')!.activity).toHaveLength(1);
  expect(runs.get('fresh')?.roleId).toBe('scout');
  expect(byCard.get('acme')?.map((item) => item.id)).toEqual(['drafting']);
  expect(byCard.get('lumen')?.map((item) => item.id)).toEqual(['fresh']);
});

it('indexes only executing job runs, oldest first, never review-seat reservations', () => {
  const data = snapshot({
    runs: [
      run('reviewer', { cardId: 'acme', roleId: 'reviewer', startedAt: ago(5) }),
      run('writer', { cardId: 'acme', startedAt: ago(9) }),
      run('seat', { cardId: 'acme', roleId: 'reviewer', reviewSeatReservation: true }),
      run('asking', { cardId: 'acme', status: 'waiting' }),
      run('chat', { threadId: 't-prep' }),
    ],
  });
  const { byCard } = liveRunIndex(data);
  expect([...byCard.keys()]).toEqual(['acme']);
  expect(byCard.get('acme')?.map((item) => item.id)).toEqual(['writer', 'reviewer']);
});
