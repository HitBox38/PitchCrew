import type {
  RuntimeAuthentication,
  RuntimeInfo,
  RuntimeUpdateInfo,
  RuntimeMaintenanceState,
  Run,
} from '@pitchcrew/core';
import { expect, it } from 'vitest';
import {
  authenticationNotice,
  lastRuntimeCheck,
  runtimeStatus,
  signInStatus,
  runtimeNeedsAttention,
  runtimeOverview,
  runtimeVersionLabel,
} from '../helpers.ts';

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

it('keeps installation, update and sign-in as separate runtime facts', () => {
  const runtime = { id: 'codex', available: true, version: '1.0.0', detail: '' } as RuntimeInfo;
  expect(runtimeStatus(runtime)).toEqual({ label: 'Compatible', tone: '' });
  expect(runtimeStatus({ ...runtime, available: false })).toEqual({
    label: 'Incompatible version',
    tone: 'ochre',
  });
  expect(
    runtimeStatus(runtime, { status: 'available', latestVersion: '1.1.0' } as RuntimeUpdateInfo),
  ).toEqual({ label: 'Update available: 1.1.0', tone: 'primary' });
  expect(signInStatus(runtime, [])).toEqual({ label: 'Sign-in not checked', tone: '' });
  expect(signInStatus(runtime, [{ result: unknown }])).toEqual({
    label: 'Sign-in not checked',
    tone: '',
  });
  expect(signInStatus(runtime, [{ result: { ...unknown, status: 'missing' } }])?.label).toBe(
    'Sign-in needed',
  );
  expect(signInStatus(runtime, [{ result: { ...unknown, status: 'authenticated' } }])?.label).toBe(
    'Signed in',
  );
  expect(signInStatus({ ...runtime, version: null } as unknown as RuntimeInfo, [])).toBeNull();
});

it('finds the latest runtime update check', () => {
  expect(lastRuntimeCheck()).toBeNull();
  expect(
    lastRuntimeCheck([
      { checkedAt: '2026-10-22T10:00:00Z' },
      { checkedAt: null },
      { checkedAt: '2026-10-23T10:00:00Z' },
    ] as RuntimeUpdateInfo[]),
  ).toBe('2026-10-23T10:00:00Z');
});

it('summarizes unique actionable installations separately from optional available updates', () => {
  const runtime = { id: 'codex', available: true, version: '1.0.0', detail: '' } as RuntimeInfo;
  const runtimes: RuntimeInfo[] = [
    runtime,
    { ...runtime, id: 'opencode', available: false },
    { ...runtime, id: 'claude-code' },
    { ...runtime, id: 'gemini-cli', available: false, version: '' },
  ];
  const state = {
    authentication: [{ runtime: 'codex', model: '', result: { ...unknown, status: 'missing' } }],
    updates: [
      { id: 'codex', status: 'available', operation: { stage: 'failed' } },
      { id: 'claude-code', status: 'current', operation: { stage: 'interrupted' } },
    ],
  } as RuntimeMaintenanceState;
  expect(runtimeNeedsAttention(runtimes[3], state)).toBe(false);
  expect(runtimeOverview(runtimes, state)).toBe('3 runtimes need attention · 1 update available.');
  expect(runtimeOverview([runtime], { ...state, updates: [] })).toBe('1 runtime needs attention.');
  expect(runtimeOverview([runtime])).toBeUndefined();
});

it('shows readable versions while preserving the original provider metadata', () => {
  const original = 'codex-cli 0.210.0';
  expect(runtimeVersionLabel(original)).toBe('0.210.0');
  expect(original).toBe('codex-cli 0.210.0');
  expect(runtimeVersionLabel('OpenCode v2.4.0-beta.1+build.12')).toBe('2.4.0-beta.1+build.12');
  expect(runtimeVersionLabel('2026.09.26-fixture')).toBe('2026.09.26-fixture');
  expect(runtimeVersionLabel('unrecognized banner\nInstall directory: fixture')).toBe(
    'unrecognized banner',
  );
  expect(runtimeVersionLabel('')).toBe('Not installed');
});
