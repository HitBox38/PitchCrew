import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComputerApproval } from '@pitchcrew/core';

vi.mock('@/WorkspaceStore/index.ts', () => ({
  useWorkspaceStore: (select: (state: { data: unknown }) => unknown) =>
    select({ data: { roles: [{ id: 'scout', name: 'Scout' }] } }),
}));

const { BrowserApprovalContent } = await import('../components/BrowserApprovalContent.tsx');

// Allowed by the user's Accept edits mode: page text is kept, the screenshot is not.
const step: ComputerApproval = {
  id: 'step',
  runId: 'run',
  roleId: 'scout',
  cardId: null,
  action: { kind: 'scroll', selector: 'body', deltaX: 0, deltaY: 600 },
  reason: 'Read the rest of the fictional listing',
  page: {
    url: 'https://jobs.example/listing',
    title: 'Fictional listing',
    text: 'Fictional listing text',
    screenshot: '',
    digest: 'page',
  },
  digest: 'action',
  status: 'consumed',
  automatic: true,
  mode: 'edits',
  error: '',
  createdAt: '2026-11-17T00:00:00.000Z',
  decidedAt: '2026-11-17T00:00:00.000Z',
};

const render = (approval: ComputerApproval) =>
  renderToStaticMarkup(
    createElement(BrowserApprovalContent, {
      approval,
      action: async () => undefined,
      working: false,
      showActions: false,
    }),
  );

it('shows the captured page image only when the request saved one', () => {
  const automatic = render(step);
  expect(automatic).not.toContain('<img');
  expect(automatic).toContain('Fictional listing text');
  expect(automatic).toContain('Ran automatically');
  expect(automatic).not.toContain('Executed');
  const pending = render({
    ...step,
    automatic: undefined,
    mode: undefined,
    status: 'pending',
    page: { ...step.page, screenshot: 'ZmljdGlvbmFs' },
  });
  expect(pending).toContain('src="data:image/jpeg;base64,ZmljdGlvbmFs"');
  expect(pending).toContain('Needs approval');
});
