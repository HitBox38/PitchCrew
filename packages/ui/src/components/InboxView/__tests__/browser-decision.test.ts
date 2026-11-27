import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComputerApproval } from '@pitchcrew/core';

// The tiles open the file viewer; here only which files reach them matters.
vi.mock('@/FileViewer/components/AttachmentList.tsx', () => ({
  AttachmentList: ({ files }: { files: { name: string }[] }) =>
    files.map((file) => file.name).join(', '),
}));

const { BrowserApprovalDetails } = await import('../components/BrowserApprovalDetails.tsx');
const { BrowserDecisionFooter } = await import('../components/BrowserDecisionFooter.tsx');

const approval: ComputerApproval = {
  id: 'upload',
  runId: 'run',
  roleId: 'submitter',
  cardId: 'job',
  action: {
    kind: 'upload',
    selector: '#resume',
    exportApprovalId: '00000000-0000-4000-8000-000000000001',
    file: 'resume.pdf',
  },
  reason: 'Attach the approved fictional resume',
  page: {
    url: 'https://jobs.example/apply',
    title: 'Fictional application',
    text: 'Fictional form text',
    screenshot: 'ZmljdGlvbmFs',
    digest: 'page',
  },
  uploadPreview: 'Fictional resume preview',
  digest: 'action',
  status: 'pending',
  error: '',
  createdAt: '2026-11-18T09:00:00.000Z',
  decidedAt: null,
};

it('leaves out only the screenshot where the host already shows the captured page', () => {
  const all = renderToStaticMarkup(createElement(BrowserApprovalDetails, { approval }));
  expect(all).toContain('captured-page.jpg, captured-page.txt, upload-preview.txt');
  const embedded = renderToStaticMarkup(
    createElement(BrowserApprovalDetails, { approval, omitScreenshot: true }),
  );
  expect(embedded).toContain('captured-page.txt, upload-preview.txt');
  expect(embedded).not.toContain('captured-page.jpg');
  expect(embedded).toContain('Attach the approved fictional resume');
});

it('passes a host scope to the approve button and keeps Decisions without a shortcut', () => {
  const footer = (props: { shortcut?: string; armedAt?: number }) =>
    renderToStaticMarkup(
      createElement(BrowserDecisionFooter, {
        computerApprovals: [approval],
        action: async () => undefined,
        working: false,
        ...props,
      }),
    );
  expect(footer({ shortcut: '.needs-row[data-open]', armedAt: 1 })).toContain('data-slot="kbd"');
  expect(footer({ shortcut: '.needs-row[data-open]' })).toContain('aria-keyshortcuts');
  const decisions = footer({});
  expect(decisions).not.toContain('aria-keyshortcuts');
  expect(decisions).toContain('This approves one exact interaction on the reviewed page.');
});
