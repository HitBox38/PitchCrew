import type { RuntimeAuthentication, Run } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { authenticationNotice } from '../helpers.ts';

const unknown: RuntimeAuthentication = {
  status: 'unknown',
  detail: 'Authentication could not be verified without a model request.',
  checkedAt: '2026-10-22T10:00:00Z',
  instructions: '',
};
const run = (patch: Partial<Run>) =>
  ({
    id: 'r',
    cardId: null,
    roleId: 'writer',
    runtime: 'codex',
    status: 'completed',
    message: '',
    startedAt: '2026-10-22T10:01:00Z',
    finishedAt: '2026-10-22T10:02:00Z',
    ...patch,
  }) as Run;

it('drops an unverifiable sign-in notice once that runtime completes a later run', () => {
  expect(authenticationNotice(unknown, [], 'codex', '')).toBe(unknown);
  expect(authenticationNotice(unknown, [run({})], 'codex', '')).toBeNull();
  expect(authenticationNotice(unknown, [run({ runtime: 'opencode' })], 'codex', '')).toBe(unknown);
  expect(authenticationNotice(unknown, [run({ status: 'failed' })], 'codex', '')).toBe(unknown);
  expect(
    authenticationNotice(unknown, [run({ finishedAt: '2026-10-22T09:00:00Z' })], 'codex', ''),
  ).toBe(unknown);
  const missing = { ...unknown, status: 'missing' as const };
  expect(authenticationNotice(missing, [run({})], 'codex', '')).toBe(missing);
});
