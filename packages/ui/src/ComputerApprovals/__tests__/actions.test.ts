import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComputerApproval } from '@pitchcrew/core';
import { shortcutAria, shortcutLabel } from '@/components/MarkdownEditor/shortcuts.ts';
import { isMac } from '@/shortcuts.ts';
import { BrowserApprovalActions } from '../components/BrowserApprovalActions.tsx';

const approval: ComputerApproval = {
  id: 'click',
  runId: 'run',
  roleId: 'scout',
  cardId: null,
  action: { kind: 'click', selector: '#more' },
  reason: 'Open the rest of the fictional listing',
  page: {
    url: 'https://jobs.example/listing',
    title: 'Fictional listing',
    text: 'Fictional listing text',
    screenshot: '',
    digest: 'page',
  },
  digest: 'action',
  status: 'pending',
  error: '',
  createdAt: '2026-11-18T09:00:00.000Z',
  decidedAt: null,
};
const render = (
  props: { shortcut?: boolean | string; armedAt?: number; approval?: ComputerApproval } = {},
) =>
  renderToStaticMarkup(
    createElement(BrowserApprovalActions, {
      approval,
      action: async () => undefined,
      working: false,
      ...props,
    }),
  );
const keys = ['Mod', 'Enter'];

it('names the keys inside the approve button only on a surface with its own scope', () => {
  const desk = render({ shortcut: '.needs-row[data-open]', armedAt: 1 });
  expect(desk).toContain(`aria-keyshortcuts="${shortcutAria(keys)}"`);
  expect(desk).toContain(`title="Approve click (${shortcutLabel(keys)})"`);
  expect(desk).toContain('data-slot="kbd"');
  expect(desk).toContain('aria-hidden="true"');
});

it('keeps the browser tray and Decisions as they were', () => {
  const tray = render({ shortcut: true });
  expect(tray).toContain(`aria-keyshortcuts="${shortcutAria(keys)}"`);
  expect(tray).toContain(`title="Approve click (${isMac ? '⌘' : 'Ctrl'}+Enter)"`);
  expect(tray).not.toContain('data-slot="kbd"');
  const decisions = render();
  expect(decisions).not.toContain('aria-keyshortcuts');
  expect(decisions).not.toContain('title=');
  expect(decisions).not.toContain('data-slot="kbd"');
  expect(decisions).toContain('>Approve click</button>');
});

it('never offers the keys for a final submission on a surface of its own', () => {
  const submission: ComputerApproval = {
    ...approval,
    action: { kind: 'click', selector: '#submit', purpose: 'submission' },
  };
  const desk = render({ approval: submission, shortcut: '.needs-row[data-open]', armedAt: 1 });
  expect(desk).toContain('>Approve submission</button>');
  expect(desk).not.toContain('aria-keyshortcuts');
  expect(desk).not.toContain('title=');
  expect(desk).not.toContain('data-slot="kbd"');
  // The tray approves beside the live page and keeps its shortcut.
  const tray = render({ approval: submission, shortcut: true });
  expect(tray).toContain(`aria-keyshortcuts="${shortcutAria(keys)}"`);
  expect(tray).toContain(`title="Approve submission (${isMac ? '⌘' : 'Ctrl'}+Enter)"`);
});

it('treats a dialog that continues an uncertain submission as a final submission', () => {
  const continuation: ComputerApproval = {
    ...approval,
    action: {
      kind: 'dialog',
      decision: 'accept',
      submissionAttemptId: '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    },
  };
  const desk = render({ approval: continuation, shortcut: '.needs-row[data-open]', armedAt: 1 });
  expect(desk).toContain('>Approve answer</button>');
  expect(desk).not.toContain('aria-keyshortcuts');
  expect(desk).not.toContain('title=');
  expect(desk).not.toContain('data-slot="kbd"');
  // A dialog that continues nothing keeps the desk's keys.
  const plain: ComputerApproval = {
    ...approval,
    action: { kind: 'dialog', decision: 'accept' },
  };
  expect(render({ approval: plain, shortcut: '.needs-row[data-open]', armedAt: 1 })).toContain(
    `aria-keyshortcuts="${shortcutAria(keys)}"`,
  );
  expect(render({ approval: continuation, shortcut: true })).toContain(
    `aria-keyshortcuts="${shortcutAria(keys)}"`,
  );
});

it('decides nothing once the request is no longer pending', () => {
  expect(
    renderToStaticMarkup(
      createElement(BrowserApprovalActions, {
        approval: { ...approval, status: 'approved' },
        action: async () => undefined,
        working: false,
        shortcut: '.needs-row[data-open]',
      }),
    ),
  ).toBe('');
});
