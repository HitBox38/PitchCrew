import { expect, it } from 'vitest';
import {
  browserErrorText,
  isUserControlError,
  isUserControlPause,
  userControlPauseLabel,
} from '../src/browser-errors.ts';

it('removes ANSI styling without losing the timeout, URL, call log or line breaks', () => {
  const plain =
    'page.goto: Timeout 20000ms exceeded.\nCall log:\n  - navigating to "https://example.com/apply", waiting until "domcontentloaded"\n';
  const formatted = plain
    .replace('  - navigating', '\u001b[2m  - navigating')
    .replace('domcontentloaded"', 'domcontentloaded"\u001b[22m');
  expect(browserErrorText(formatted)).toBe(plain);
  expect(browserErrorText(browserErrorText(formatted))).toBe(plain);
});

it('removes terminal colour, cursor and hyperlink controls while retaining diagnostic text', () => {
  expect(
    browserErrorText(
      '\u001b[31mFailed\u001b[0m\n\u001b[2K\u001b[1G\u001b]8;;https://example.com\u0007page\u001b]8;;\u0007',
    ),
  ).toBe('Failed\npage');
});

it.each([
  '',
  'The page changed. Inspect it and request a new approval.',
  'net::ERR_NAME_NOT_RESOLVED\n  at navigate (driver.ts:42)',
  'Selector [name="resume"] was not found.',
])('preserves ordinary diagnostics: %s', (message) => {
  expect(browserErrorText(message)).toBe(message);
});

it('recognizes the browser errors a user takeover produces, including expired approvals', () => {
  for (const message of [
    'Manual control is active. Wait for the user to return browser control.',
    'Manual control changed. Inspect the browser again.',
    'Browser action is rejected. Manual control invalidated browser approval.',
    'Browser control changed. Inspect again.',
    'Browser is controlled in another view. Return control there first.',
  ])
    expect(isUserControlError(message)).toBe(true);
  expect(isUserControlError('Browser action is rejected.')).toBe(false);
  expect(isUserControlError('page.goto: Timeout 20000ms exceeded.')).toBe(false);
  expect(isUserControlPause({ status: 'interrupted', label: userControlPauseLabel })).toBe(true);
  expect(isUserControlPause({ status: 'failed', label: userControlPauseLabel })).toBe(false);
});
