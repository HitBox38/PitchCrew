import { expect, it } from 'vitest';
import { browserApprovalError } from '../error.ts';

const approval = {
  status: 'failed' as const,
  action: { kind: 'navigate' as const, url: 'https://example.com/apply' },
  error:
    'page.goto: Timeout 20000ms exceeded.\nCall log:\n\u001b[2m  - navigating to "https://example.com/apply"\u001b[22m\n',
};

it('explains an approved navigation timeout independently of its technical diagnostics', () => {
  expect(browserApprovalError(approval)).toEqual({
    summary: 'You approved this request, but opening the page timed out after 20 seconds.',
    diagnostics:
      'page.goto: Timeout 20000ms exceeded.\nCall log:\n  - navigating to "https://example.com/apply"\n',
  });
  expect(approval.status).toBe('failed');
  expect(approval.error).toContain('\u001b[2m');
});

it('retains ordinary failures as diagnostics without treating them as navigation timeouts', () => {
  const error = 'The page changed. Inspect it and request a new approval.';
  expect(browserApprovalError({ ...approval, error })).toEqual({
    summary: 'You approved this request, but the browser action failed.',
    diagnostics: error,
  });
  expect(
    browserApprovalError({ ...approval, error: 'locator.click: Timeout 20000ms exceeded.' })
      ?.summary,
  ).toBe('You approved this request, but the browser action failed.');
});

it('does not claim personal approval for automatic or rejected requests', () => {
  expect(browserApprovalError({ ...approval, automatic: true })?.summary).toBe(
    'This request was allowed automatically, but opening the page timed out after 20 seconds.',
  );
  expect(
    browserApprovalError({
      ...approval,
      status: 'rejected',
      error: '\u001b[2mBrowser session ended.\u001b[22m',
    })?.summary,
  ).toBe('Browser session ended.');
});

it('omits empty and formatting-only errors', () => {
  expect(browserApprovalError({ ...approval, error: '' })).toBeNull();
  expect(browserApprovalError({ ...approval, error: '\u001b[2m\u001b[22m' })).toBeNull();
});
