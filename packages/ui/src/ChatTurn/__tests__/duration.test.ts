import { afterEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Run, UserInputRequest } from '@pitchcrew/core';
import { TurnDuration } from '../components/TurnDuration.tsx';

const data = vi.hoisted(() => ({
  userInputs: [] as UserInputRequest[],
  runs: [] as Run[],
}));
vi.mock('@/WorkspaceStore/index.ts', () => ({
  useWorkspaceStore: (select: (state: { data: typeof data }) => unknown) => select({ data }),
}));
afterEach(() => {
  data.userInputs = [];
  data.runs = [];
  vi.restoreAllMocks();
});

it('keeps work before a pending question visible without a finished timestamp', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-06T12:30:00Z'));
  data.userInputs = [
    {
      runId: 'waiting-run',
      createdAt: '2026-11-06T12:00:10Z',
      status: 'pending',
    } as UserInputRequest,
  ];
  const html = renderToStaticMarkup(
    createElement(TurnDuration, {
      runId: 'waiting-run',
      startedAt: '2026-11-06T12:00:00Z',
      finishedAt: null,
      active: false,
    }),
  );
  expect(html).toContain('>10s');
  expect(html).toContain('waiting for your answer');
});

it('does not invent elapsed work for an unfinished historical record without activity', () => {
  const html = renderToStaticMarkup(
    createElement(TurnDuration, {
      runId: 'legacy-run',
      startedAt: '2026-11-06T12:00:00Z',
      finishedAt: null,
      active: false,
    }),
  );
  expect(html).toContain('&lt;1s');
});
