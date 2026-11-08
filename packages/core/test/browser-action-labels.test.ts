import { expect, it } from 'vitest';
import type { BrowserSnapshot } from '../src/computer.ts';
import {
  browserActionAsked,
  browserActionDone,
  browserActionParts,
  browserActionPublic,
  browserActionSummary,
  middleTruncate,
  publicText,
} from '../src/browser-action-labels.ts';

const page: BrowserSnapshot = {
  url: 'https://httpbin.org/forms/post',
  title: 'Form',
  text: '',
  screenshot: '',
  digest: 'page',
  elements: [{ ref: 'target', tag: 'input', name: 'Customer name' }],
};

it('writes requests with the exact value and a target that is never the part that shortens', () => {
  const fill = { kind: 'fill', selector: 'input[name=custname]', value: 'Ada Lovelace' } as const;
  expect(browserActionSummary(fill, page)).toBe('Type “Ada Lovelace” into “Customer name”');
  expect(
    browserActionParts(
      { ...fill, value: 'A very long cover letter answer that keeps going and going' },
      page,
    ),
  ).toEqual({
    verb: 'Type',
    value: '“A very long…g and going”',
    joiner: 'into',
    target: '“Customer name”',
  });
  expect(browserActionSummary({ kind: 'navigate', url: 'https://httpbin.org/forms/post' })).toBe(
    'Open httpbin.org/forms/post',
  );
  expect(browserActionSummary({ kind: 'click', selector: '#x' }, { ...page, elements: [] })).toBe(
    'Click an element on httpbin.org',
  );
  expect(middleTruncate('abcdefghij', 5)).toBe('ab…ij');
});

it('labels chat steps without the values the action typed or chose', () => {
  const fill = { kind: 'fill', selector: 'input', value: 'private answer' } as const;
  expect(browserActionDone(fill, page)).toBe('Typed into “Customer name”');
  expect(browserActionAsked(fill, page)).toBe('Asked to type into “Customer name”');
  expect(browserActionDone({ kind: 'select', selector: 'select', value: 'Secret' }, page)).toBe(
    'Chose an option in “Customer name”',
  );
  expect(
    browserActionDone({ kind: 'navigate', url: 'https://example.com/apply?token=abc' }, page),
  ).toBe('Opened example.com');
  expect(
    browserActionDone(
      { kind: 'click', selector: 'a' },
      { ...page, elements: [{ ref: 'target', tag: 'a', name: 'Learn more' }] },
    ),
  ).toBe('Clicked “Learn more”');
  for (const label of [browserActionDone(fill, page), browserActionAsked(fill, page)])
    expect(label).not.toContain('private');
});

it('keeps public labels to redacted element names, without URL secrets or raw control labels', () => {
  const fill = { kind: 'fill', selector: '#pw', value: 'x' } as const;
  // An inspected control's label is for the approval review only, never chat activity.
  const withControl: BrowserSnapshot = {
    ...page,
    elements: [{ ref: 'target', tag: 'input', name: '[hidden]' }],
    controls: [
      {
        selector: '#pw',
        label: 'FICTIONAL_CREDENTIAL',
        type: 'text',
        required: false,
        visible: true,
        disabled: false,
        accept: '',
        options: [],
      },
    ],
  };
  expect(browserActionAsked(fill, withControl)).toBe('Asked to type into a field');
  expect(browserActionSummary(fill, withControl)).toContain('FICTIONAL_CREDENTIAL');
  const link: BrowserSnapshot = {
    ...page,
    elements: [
      { ref: 'target', tag: 'a', name: 'https://example.com/reset?token=FICTITIOUS_SECRET_VALUE' },
    ],
  };
  expect(browserActionDone({ kind: 'click', selector: 'a' }, link)).toBe('Clicked “example.com”');
  const token: BrowserSnapshot = {
    ...page,
    elements: [{ ref: 'target', tag: 'span', name: 'Code abcdefghijklmnopqrstuvwxyz0123456789' }],
  };
  expect(browserActionPublic({ kind: 'click', selector: 'span' }, token)).toBe('Click “Code …”');
});

it('reduces URLs in public text to their hostname, dropping userinfo, paths and short tokens', () => {
  expect(publicText('Reset at https://alice:pw123@example.com/reset/abc123?token=short')).toBe(
    'Reset at example.com',
  );
  expect(publicText(`Code ${'a'.repeat(70)}abcdefghij`)).toBe('Code …');
});

it('reduces scheme-less addresses too: protocol-relative URLs, bare hosts, IPs and emails', () => {
  for (const [input, output] of [
    ['//alice:pw123@example.com/reset/abc123', 'example.com'],
    ['www.example.com/reset?token=short', 'www.example.com'],
    ['Open jobs.example.org:8443/apply/123', 'Open jobs.example.org'],
    ['127.0.0.1:8080/reset/abc123?token=short', '127.0.0.1'],
    ['Write to alice@example.com today', 'Write to … today'],
    ['alice:pw123@example.com/reset', ''],
    ['HTTPS://Example.com/x?y=1', 'example.com'],
    ['Learn more', 'Learn more'],
    ['Version 1.2 notes', 'Version 1.2 notes'],
  ])
    expect(publicText(input)).toBe(output);
  expect(
    browserActionAsked(
      { kind: 'click', selector: 'a' },
      {
        ...page,
        elements: [{ ref: 'target', tag: 'a', name: 'www.example.com/reset?token=short' }],
      },
    ),
  ).toBe('Asked to click “www.example.com”');
});

it('drops every other address form and falls back to a generic label when nothing else is left', () => {
  for (const [input, output] of [
    ['localhost:3000/x?token=x', 'localhost'],
    ['例子.公司/reset/abc123?token=x', 'xn--fsqu00a.xn--55qx5d'],
    ['xn--fsqu00a.xn--55qx5d/reset/abc123?token=x', 'xn--fsqu00a.xn--55qx5d'],
    ['tel:+972501234567', ''],
    ['javascript:alert(secret)', ''],
    [String.raw`C:\Users\name\secret.txt`, ''],
    ['/reset/abc123?token=x', ''],
    ['/reset/abc123', ''],
    ['mailto:user@example.com?subject=secret', ''],
    ['“//internal/reset/abc123?token=x”', '“internal'],
    ['Customer name:', 'Customer name:'],
    ['Step 2: confirm', 'Step 2: confirm'],
    ['Ratio 3:2 and/or 24/7', 'Ratio 3:2 and/or 24/7'],
    ['v1.2/3 e.g./i.e. Q4/2026 1.2.3.4', 'v1.2/3 e.g./i.e. Q4/2026 1.2.3.4'],
  ])
    expect(publicText(input)).toBe(output);
  // End to end through the chat activity label: a path-only name gives the generic fallback.
  expect(
    browserActionAsked(
      { kind: 'click', selector: 'a' },
      { ...page, elements: [{ ref: 'target', tag: 'a', name: '/reset/abc123?token=x' }] },
    ),
  ).toBe('Asked to click an element on httpbin.org');
});
