import { expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WritingGuide } from '@pitchcrew/core';
import { guideChange } from '../helpers.ts';

// Static rendering cannot click, so the buttons hand their handlers to the test by label.
const { clicks } = vi.hoisted(() => ({ clicks: new Map<string, () => void>() }));
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

const { GuideProposal } = await import('../components/GuideProposal.tsx');

const proposal: WritingGuide['proposals'][number] = {
  id: 'suggestion',
  text: 'Lead with the outcome, then the method.',
  scope: 'all',
  reason: 'Two fictional cover letters buried the result.',
  roleId: 'reviewer',
  runId: 'run',
  revision: 3,
  status: 'pending',
};
const guide = {
  id: 'writing-guide',
  revision: 3,
  automatic: false,
  learningSince: '2026-11-01T00:00:00.000Z',
  preferences: [],
  proposals: [proposal],
} as WritingGuide;

it('sends one guide change with the revision it was made against', async () => {
  const action = vi.fn(async () => undefined);
  await guideChange(action, 3)({ action: 'proposal_decision', id: 'suggestion', approved: true });
  expect(action).toHaveBeenCalledWith(
    '/quality',
    'POST',
    { revision: 3, action: 'proposal_decision', id: 'suggestion', approved: true },
    'Writing guide updated',
  );
});

it('applies or dismisses one suggestion through the change it is given', () => {
  const change = vi.fn(async () => undefined);
  const card = renderToStaticMarkup(
    createElement(GuideProposal, { proposal, guide, roleName: 'Reviewer', change, working: false }),
  );
  expect(card).toContain('Proposed by Reviewer');
  expect(card).not.toContain('The guide changed since this was proposed.');
  clicks.get('Apply suggestion')?.();
  clicks.get('Dismiss')?.();
  expect(change.mock.calls).toEqual([
    [{ action: 'proposal_decision', id: 'suggestion', approved: true }],
    [{ action: 'proposal_decision', id: 'suggestion', approved: false }],
  ]);
});

it('holds a suggestion made against an older guide', () => {
  const stale = renderToStaticMarkup(
    createElement(GuideProposal, {
      proposal,
      guide: { ...guide, revision: 4 },
      roleName: 'Reviewer',
      change: async () => undefined,
      working: false,
    }),
  );
  expect(stale).toContain('The guide changed since this was proposed. Ask for a fresh one.');
  expect(stale).toMatch(/<button[^>]*disabled=""[^>]*>Apply suggestion/);
});
