import { expect, it } from 'vitest';
import type { BrowserSnapshot } from '../src/computer.ts';
import {
  browserActionAsked,
  browserActionDone,
  browserActionParts,
  browserActionSummary,
  middleTruncate,
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
