import { beforeEach, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Card, TrackingSignal } from '@pitchcrew/core';
import { clockLabel } from '@/lib/time.ts';

// Static rendering cannot click, so the buttons hand their handlers to the test by label.
const { clicks, store } = vi.hoisted(() => ({
  clicks: new Map<string, () => void>(),
  store: { action: vi.fn(async () => undefined), working: false },
}));
vi.mock('@pitchcrew/design-system/button', async () => {
  const { createElement: h } = await import('react');
  return {
    Button: ({ children, onClick, ...props }: { children?: ReactNode; onClick?: () => void }) => {
      const label = [children].flat().find((child) => typeof child === 'string');
      if (typeof label === 'string' && onClick) clicks.set(label, onClick);
      return h('button', props, children);
    },
  };
});
vi.mock('@/WorkspaceStore/index.ts', () => ({
  useWorkspaceStore: (select: (state: typeof store) => unknown) => select(store),
}));

const { TrackingProposal } = await import('../components/TrackingProposal.tsx');
const { TrackingEvidence } = await import('../components/TrackingEvidence.tsx');

const card = {
  id: 'job',
  company: 'Bluefin',
  title: 'Platform Engineer',
  state: 'submitted',
  url: 'https://jobs.example/bluefin',
  updatedAt: '2026-11-18T08:00:00.000Z',
} as Card;
const signal = {
  id: 'signal',
  company: 'Bluefin',
  title: 'Platform Engineer',
  state: 'screening',
  from: 'Fictional Recruiter <recruiting@example.com>',
  subject: 'Next steps',
  quote: 'We would like to schedule a first call.',
  sourceText: 'We would like to schedule a first call.',
  sourceTruncated: false,
  effectiveAt: '2026-11-18T07:00:00.000Z',
  candidateIds: ['job'],
  reason: 'The email invites the candidate to a screening call.',
} as TrackingSignal;
const render = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(TrackingProposal, { signal, cards: [card], ...props }));

beforeEach(() => {
  clicks.clear();
  store.action.mockClear();
});

it('keeps its heading, box and evidence on its own; a host that shows them gets its order', () => {
  const boxed = render();
  expect(boxed).toMatch(/^<article class="form my-3 rounded border border-border p-3"><h3>/);
  expect(boxed).toContain('Bluefin · Platform Engineer → Screening');
  // On its own, as before: the evidence, then what approving does, then the verbs.
  const at = (html: string, words: string) => html.indexOf(words);
  expect(at(boxed, 'schedule a first call')).toBeLessThan(at(boxed, 'Approval links'));
  expect(at(boxed, 'Approval links')).toBeLessThan(at(boxed, 'Apply update'));
  // Home's row names the change and shows the evidence itself (`TrackingEvidence`), so the review
  // brings the application and the verbs, with what approving does under them.
  const headless = render({ headless: true });
  expect(headless).toMatch(/^<div class="form">/);
  expect(headless).not.toContain('<h3>');
  expect(headless).not.toContain('schedule a first call');
  expect(at(headless, 'Application')).toBeLessThan(at(headless, 'Apply update'));
  expect(at(headless, 'Apply update')).toBeLessThan(
    at(headless, 'Approval links this email thread'),
  );
});

it('dates the email as Home writes times: a clock time with a day word, never seconds', () => {
  const html = renderToStaticMarkup(createElement(TrackingEvidence, { signal }));
  expect(html).toContain(clockLabel(signal.effectiveAt));
  expect(html).not.toMatch(/\d:\d\d:\d\d/);
  expect(html).toContain('schedule a first call');
  expect(html).toContain(signal.reason);
});

it('sends the same decisions through the workspace action or a host’s own', () => {
  render();
  clicks.get('Apply update')?.();
  expect(store.action).toHaveBeenCalledWith(
    '/tracking/evidence/signal/decision',
    'POST',
    { approved: true, cardId: 'job', cardUpdatedAt: '2026-11-18T08:00:00.000Z' },
    'Tracking update applied',
  );
  const host = vi.fn(async () => undefined);
  render({ action: host, headless: true });
  clicks.get('Reject')?.();
  clicks.get('Refresh comparison')?.();
  expect(host.mock.calls).toEqual([
    ['/tracking/evidence/signal/decision', 'POST', { approved: false }, 'Tracking update rejected'],
    ['/tracking/evidence/signal/refresh', 'POST', {}, 'Application comparison refreshed'],
  ]);
  expect(store.action).toHaveBeenCalledTimes(1);
});

it('marks Apply update as the glaze only for a host scope, and waits for an application', () => {
  expect(render()).not.toContain('aria-keyshortcuts');
  const desk = render({ shortcut: '.needs-row[data-open]', armedAt: 1 });
  expect(desk).toContain('aria-keyshortcuts');
  expect(desk).toContain('data-slot="kbd"');
  const uncertain = render({ signal: { ...signal, candidateIds: [] } });
  expect(uncertain).toMatch(/<button[^>]*disabled=""[^>]*>Apply update/);
});
