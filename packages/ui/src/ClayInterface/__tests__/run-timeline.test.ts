import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Run } from '@pitchcrew/core';
import { run } from '@/lib/__tests__/attention-fixture.ts';
import { clockLabel } from '@/lib/time.ts';

// Static rendering has no store: the groove reads its runs from this stub.
const state = vi.hoisted(() => ({ data: { runs: [] as Run[] } }));
vi.mock('@/WorkspaceStore/index.ts', () => ({
  useWorkspaceStore: (select: (value: typeof state) => unknown) => select(state),
}));
const { RunTimeline } = await import('../components/RunTimeline.tsx');

/** The groove's start, as the card prints it under the groove. */
const start = () =>
  renderToStaticMarkup(createElement(RunTimeline, { roleId: 'scout' })).match(
    /clay-run-timeline-labels"><span>([^<]*)</,
  )?.[1];
const today = (hours: number, minutes: number) => new Date().setHours(hours, minutes, 0, 0);

it('writes the groove’s start in the shared clock, as the runs listed under it', () => {
  // An idle agent's groove starts at 8:00, never "08:00 AM" over a list that says "8:00 AM".
  expect(start()).toBe(clockLabel(today(8, 0)));
  // A first run before eight moves the start, in the same clock.
  const early = today(7, 5);
  state.data.runs = [
    run('early', {
      roleId: 'scout',
      status: 'completed',
      startedAt: new Date(early).toISOString(),
      finishedAt: new Date(early + 60_000).toISOString(),
    }),
  ];
  expect(start()).toBe(clockLabel(early));
});
