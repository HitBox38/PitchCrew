import { expect, it } from 'vitest';
import type { BrowserSnapshot } from '@pitchcrew/core';
import { actionFields, describePageElement } from '../helpers.ts';

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
