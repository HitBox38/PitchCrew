import { expect, it } from 'vitest';
import type { BrowserSnapshot } from '@pitchcrew/core';
import { actionFields, approvalSummary, describePageElement } from '../helpers.ts';

const page = {
  url: 'https://jobs.example/apply',
  title: 'Apply',
  text: '',
  screenshot: '',
  digest: 'page',
  controls: [
    {
      selector: ':nth-match(:is(input,textarea,select), 2)',
      label: 'Email',
      type: 'email',
      required: true,
      visible: true,
      disabled: false,
      accept: '',
      options: [],
    },
  ],
} satisfies BrowserSnapshot;

it('names inspected form controls and leaves generated selectors to the agent reason', () => {
  expect(describePageElement(':nth-match(:is(input,textarea,select), 2)', page)).toBe(
    'Email (email)',
  );
  expect(describePageElement(':nth-match(:is(body,a,button), 4)', page)).toBe('');
  expect(describePageElement('#apply', page)).toBe('#apply');
});

it('keeps exact selectors in evidence views and describes them in the compact tray', () => {
  const click = { kind: 'click', selector: ':nth-match(:is(body,a,button), 4)' } as const;
  expect(actionFields(click)).toEqual([['Page element', click.selector]]);
  expect(actionFields(click, page)).toEqual([]);
  const fill = {
    kind: 'fill',
    selector: ':nth-match(:is(input,textarea,select), 2)',
    value: 'person@example.com',
  } as const;
  expect(actionFields(fill, page)).toEqual([
    ['Page element', 'Email (email)'],
    ['Value', 'person@example.com'],
  ]);
});

it('writes the tray title itself, with the exact value and a named or located target', () => {
  const email = ':nth-match(:is(input,textarea,select), 2)';
  expect(
    approvalSummary({ kind: 'fill', selector: email, value: 'person@example.com' }, page),
  ).toBe('Type “person@example.com” into “Email”');
  expect(
    approvalSummary(
      {
        kind: 'fill',
        selector: '#bio',
        value: 'A long answer\nthat spans lines and keeps going on',
      },
      page,
    ),
  ).toBe('Type “A long answer that spans lines…” into a field');
  expect(approvalSummary({ kind: 'select', selector: email, value: 'Israel' }, page)).toBe(
    'Choose “Israel” in “Email”',
  );
  // Without a name the title says where, never the agent's reason.
  expect(approvalSummary({ kind: 'click', selector: '#x' }, page)).toBe(
    'Click an element on jobs.example',
  );
  expect(
    approvalSummary(
      { kind: 'click', selector: 'ref:1' },
      { ...page, elements: [{ ref: 'target', tag: 'a', name: 'Learn more' }] },
    ),
  ).toBe('Click “Learn more”');
  expect(approvalSummary({ kind: 'navigate', url: 'https://www.iana.org/help' })).toBe(
    'Open www.iana.org',
  );
});
