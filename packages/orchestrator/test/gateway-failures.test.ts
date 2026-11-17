import { LifecycleError, toolFailureDescriptions, userDeclinedError } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { classifyToolFailure } from '../src/crew/gateway/failures.ts';
import { QueueBusyError } from '../src/crew/queue/admission.ts';

const classify = (error: unknown, action = 'profile', aborted = false) =>
  classifyToolFailure(action, error, aborted, ['fixture-run-token']);
const coded = (message: string, code: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(message), { code, ...extra });
const named = (message: string, name: string) => Object.assign(new Error(message), { name });
const zodError = (schema: z.ZodType, input: unknown) => {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('Fixture input must be invalid.');
  return result.error;
};

describe('gateway tool failure classifier', () => {
  it('names the user’s own outcomes without a reason sentence', () => {
    const control = new Error(
      'Manual control is active. Wait for the user to return browser control.',
    );
    expect(classify(new Error(userDeclinedError), 'computer_execute')).toEqual({
      reason: 'declined',
    });
    expect(classify(control, 'computer_inspect')).toEqual({ reason: 'user_control' });
    expect(classify(new Error('Run capability is invalid or expired.'), 'profile', true)).toEqual({
      reason: 'cancelled',
    });
    expect(classify(new DOMException('The operation was aborted.', 'AbortError'))).toEqual({
      reason: 'cancelled',
    });
  });

  it.each([
    [named('page.goto: Timeout 30000ms exceeded.', 'TimeoutError'), 'timeout'],
    [new Error('GitHub CLI request failed or timed out. Try again.'), 'timeout'],
    [Object.assign(new Error('Bad input'), { statusCode: 400 }), 'invalid_input'],
    [Object.assign(new Error('Who are you'), { statusCode: 401 }), 'not_allowed'],
    [Object.assign(new Error('No access'), { statusCode: 403 }), 'not_allowed'],
    [Object.assign(new Error('Profile note not found.'), { statusCode: 404 }), 'not_found'],
    [Object.assign(new Error('This note changed on disk.'), { statusCode: 409 }), 'conflict'],
    [Object.assign(new Error('Slow down'), { statusCode: 429 }), 'limit_reached'],
    [Object.assign(new Error('Upstream'), { statusCode: 503 }), 'unavailable'],
    [new LifecycleError('Run', 'completed', 'running', []), 'conflict'],
    [new QueueBusyError('This job or conversation already has active work.'), 'limit_reached'],
    [new TypeError('fetch failed', { cause: coded('connect', 'ENOTFOUND') }), 'unavailable'],
    [new TypeError("Cannot read properties of undefined (reading 'id')"), 'internal'],
    [new RangeError('Invalid array length'), 'internal'],
    [coded('database is locked', 'SQLITE_BUSY'), 'internal'],
    [new Error('Install GitHub CLI, then try connecting again.'), 'setup_required'],
    [
      new Error('GitHub CLI account changed. Reconnect GitHub in Settings → Accounts.'),
      'setup_required',
    ],
    [new Error('Connect Gmail before scanning applications.'), 'setup_required'],
    [new Error('The profile source account is disconnected.'), 'setup_required'],
    [new Error('This runtime is not installed. Check Crew settings.'), 'setup_required'],
    [new Error('Invalid or expired authorization grant. Connect again.'), 'setup_required'],
    // Mentioning installing or connecting is not an instruction to set something up.
    [new Error('Cannot install skills while an import is in progress.'), 'limit_reached'],
    [new Error('Skills can only install from approved proposals.'), 'not_allowed'],
    [new Error('Could not connect to the posting site.'), 'unavailable'],
    [new Error('Could not reach the job board: fetch failed'), 'unavailable'],
    // Bun's fetch wording names "connect", which is not a setup step here.
    [
      new Error(
        'Could not reach the job board: ECONNREFUSED: Unable to connect. Is the computer able to access the url?',
      ),
      'unavailable',
    ],
    // Only the desktop browser's outage is a fault; other "unavailable" wording is a refusal.
    [new Error('Browser tab targeting is unavailable.'), 'rejected'],
    [new Error('The selected review runtime is unavailable.'), 'rejected'],
    [new Error('Connector request failed (502). Check the resource ID or query.'), 'unavailable'],
    [new Error('Connector request failed (404). Check the resource ID or query.'), 'not_found'],
    [new Error('Connector rate limit reached. Retry later.'), 'limit_reached'],
    [new Error('Three proposals maximum per run.'), 'limit_reached'],
    [new Error('An attachment is being read. Try again when that read finishes.'), 'limit_reached'],
    [new Error('Profile notes changed since detection. Detect again.'), 'conflict'],
    [new Error('Cannot move lead to offer.'), 'conflict'],
    [new Error('Attachment not found.'), 'not_found'],
    [new Error('This page needs an exact supervised approval.'), 'approval_required'],
    [new Error('Workflow capability is disabled for your role.'), 'not_allowed'],
    [new Error('Deep review is scoped to the attached job.'), 'not_allowed'],
    [new Error('This tool is not allowed.'), 'not_allowed'],
    [new Error('This chat has no attached application.'), 'rejected'],
    ['a thrown string', 'unclassified'],
    [undefined, 'unclassified'],
  ])('classifies %s as %s', (error, reason) => {
    expect(classify(error).reason).toBe(reason);
  });

  it('shows a refusal’s first line only, without a call log or the run token', () => {
    const packet = new Error(
      'This packet no longer passes its checks. Request changes and review it again.\nResume line “Led a private team” does not match',
    );
    expect(classify(packet)).toEqual({
      reason: 'rejected',
      message: 'This packet no longer passes its checks. Request changes and review it again.',
    });
    expect(
      classify(
        new Error('\n  Could not read the posting. Call log: waiting for locator("#private")'),
      ),
    ).toEqual({ reason: 'rejected', message: 'Could not read the posting.' });
    expect(classify(new Error('Token fixture-run-token was rejected.')).message).toBe(
      'Token [redacted] was rejected.',
    );
    expect(classify(new Error('x'.repeat(500))).message).toHaveLength(300);
    expect(classify('a thrown string').message).toBe(toolFailureDescriptions.unclassified);
  });

  it('takes the reason from the line it shows, never from a call log or quoted packet text', () => {
    // Real Playwright text: its call log previews the element it found ("Sign in", "Approval").
    const playwright = (preview: string, typed: string) =>
      new Error(
        `fill: Error: Element is not an <input>, <textarea>, <select> or [contenteditable] and does not have a role allowing [aria-readonly]\nCall log:\n  - waiting for locator('#field')\n    - locator resolved to ${preview}\n    - fill("${typed}")\n  - attempting fill action\n    - waiting for element to be visible, enabled and editable\n`,
      );
    for (const error of [
      playwright('<a id="field" href="/login">Sign in</a>', 'hello there'),
      playwright('<div id="field">Approval workflow</div>', 'hello'),
      playwright('<p id="field">Your session timed out</p>', 'hello'),
    ])
      expect(classify(error, 'computer_execute')).toEqual({
        reason: 'rejected',
        message: 'The browser could not carry out this step.',
      });
    // A failed packet check quotes the packet in its findings, one per line after the first.
    const checks = 'This packet no longer passes its checks. Request changes and review it again.';
    for (const finding of [
      'Source does not support: Helped teams connect with customers',
      'Source does not support: Led the approval workflow redesign',
      'Resume exceeds 650 words.',
    ])
      expect(classify(new Error(`${checks}\n${finding}`), 'export')).toEqual({
        reason: 'rejected',
        message: checks,
      });
    // The user's own outcomes still count on any line.
    expect(
      classify(
        new Error('Step failed.\nManual control is active. Wait for the user.'),
        'computer_wait',
      ),
    ).toEqual({ reason: 'user_control' });
  });

  it('treats a desktop browser that did not connect or is unavailable as unreachable', () => {
    for (const message of [
      'The native browser tab did not connect. Inspect again.',
      'The desktop browser is unavailable. Reopen it in the desktop app.',
      'The desktop browser disconnected. Reopen it in the desktop app.',
    ])
      expect(classify(new Error(message), 'computer_inspect')).toEqual({
        reason: 'unavailable',
        message: 'The browser could not be reached.',
      });
  });

  it('summarizes at most two validation issues without values or unknown key names', () => {
    const schema = z
      .object({
        content: z.string().max(5),
        limit: z.number(),
        cardId: z.uuid(),
        answers: z.record(z.string(), z.object({ value: z.number() })),
      })
      .strict();
    const error = zodError(schema, {
      content: 'private value',
      limit: 'private',
      cardId: 'private-id',
      answers: { 'Private Person': { value: 'private' } },
      privateKey: 1,
    });
    const { reason, message } = classify(error);
    expect(reason).toBe('invalid_input');
    expect(message).toBe(
      'Too big: expected string to have <=5 characters at content; Invalid input: expected number, received string at limit (+3 more)',
    );
    expect(
      classify(zodError(schema.pick({ content: true }).strict(), { content: 'ok', privateKey: 1 })),
    ).toEqual({ reason: 'invalid_input', message: 'Unexpected field' });
    // A record key is anything; the path stops before it.
    expect(
      classify(zodError(schema.pick({ answers: true }), { answers: { 'Private Person': {} } })),
    ).toEqual({
      reason: 'invalid_input',
      message: 'Invalid input: expected number, received undefined at answers',
    });
    expect(JSON.stringify(classify(error))).not.toMatch(/private|Private/);
  });

  it('never shows a system error’s path or host', () => {
    const missing = coded(
      "ENOENT: no such file or directory, open '/Users/person/private/attachment.pdf'",
      'ENOENT',
      { errno: -2, syscall: 'open', path: '/Users/person/private/attachment.pdf' },
    );
    expect(classify(missing)).toEqual({
      reason: 'not_found',
      message: 'A local file could not be read or written.',
    });
    expect(classify(coded("EACCES: permission denied, open '/Users/person/x'", 'EACCES'))).toEqual({
      reason: 'not_allowed',
      message: 'A local file could not be read or written.',
    });
    expect(
      classify(coded("EISDIR: illegal operation, read '/Users/person'", 'EISDIR')).reason,
    ).toBe('internal');
    // Bun's fetch: a TypeError carrying the system code and the address.
    const refused = Object.assign(
      new TypeError('ECONNREFUSED: Unable to connect. Is the computer able to access the url?'),
      { code: 'ECONNREFUSED', path: 'https://private.example.test/jobs?token=x' },
    );
    const unreachable = 'A service the tool depends on could not be reached.';
    expect(classify(refused)).toEqual({ reason: 'unavailable', message: unreachable });
    expect(classify(coded('getaddrinfo ENOTFOUND private.example.test', 'ENOTFOUND'))).toEqual({
      reason: 'unavailable',
      message: unreachable,
    });
    expect(classify(coded('connect ETIMEDOUT 10.0.0.7:443', 'ETIMEDOUT'))).toEqual({
      reason: 'timeout',
      message: unreachable,
    });
    expect(
      classify(new TypeError("Cannot read properties of undefined (reading 'secret')")),
    ).toEqual({
      reason: 'internal',
      message: 'Pitchcrew hit an internal error.',
    });
  });

  it('gives browser tools a fixed sentence: no typed value, URL or call log', () => {
    const playwright = new Error(
      'fill("SECRET_VALUE")\nCall log: navigating to "https://example.test/private?token=x"',
    );
    const timeout = named(
      'locator.fill: Timeout 30000ms exceeded.\nCall log:\n  - fill("SECRET_VALUE")\n  - navigating to "https://example.test/private?token=x"',
      'TimeoutError',
    );
    for (const action of [
      'computer_execute',
      'assess_form',
      'capture_submission',
      'computer_wait',
    ]) {
      const failure = classify(playwright, action);
      expect(failure).toEqual({
        reason: 'rejected',
        message: 'The browser could not carry out this step.',
      });
      expect(classify(timeout, action)).toEqual({
        reason: 'timeout',
        message: 'The page did not respond in time.',
      });
      expect(JSON.stringify([failure, classify(timeout, action)])).not.toMatch(
        /SECRET_VALUE|example\.test|Call log|token/,
      );
    }
    expect(classify(new Error('Approval was already used.'), 'computer_execute').message).toBe(
      'The page or its approval changed before the step could run.',
    );
    expect(classify(new Error('Computer use is disabled.'), 'computer_inspect').message).toBe(
      "This agent isn't allowed to do that in the browser.",
    );
  });
});
