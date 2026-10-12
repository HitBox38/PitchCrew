import { afterEach, expect, it, vi } from 'vitest';
import type { Snapshot } from '@pitchcrew/core';

const captureDiagnostic = vi.hoisted(() => vi.fn());
vi.mock('../../../WorkspaceStore/index.ts', async () => {
  const { create } = await import('zustand');
  return { useWorkspaceStore: create<{ data: Snapshot | null }>(() => ({ data: null })) };
});
vi.mock('../../client.ts', () => ({ analytics: { captureDiagnostic, capture: vi.fn() } }));
import { useDevicePreferences } from '../../../lib/device-preferences.ts';
import { useWorkspaceStore } from '../../../WorkspaceStore/index.ts';
import { installApplicationMetrics } from '../install.ts';
import { beginApiMetric, configureApplicationMetrics } from '../runtime.ts';

afterEach(() => {
  configureApplicationMetrics(null);
  useWorkspaceStore.setState({ data: null });
  useDevicePreferences.setState({ analytics: true, diagnostics: true });
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

it('revokes pending measurements across a disable/re-enable cycle and clears run history synchronously', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-12T00:00:01Z'));
  const send = vi.fn().mockResolvedValue(new Response());
  vi.stubGlobal('fetch', send);
  const stop = installApplicationMetrics({
    token: 'phc_fictional',
    host: 'https://eu.i.posthog.com',
  });
  vi.setSystemTime(new Date('2026-10-12T00:00:02Z'));
  const active = {
    id: 'local-only',
    status: 'running',
    mode: 'chat',
    startedAt: '2026-10-12T00:00:02Z',
    finishedAt: null,
  };
  useWorkspaceStore.setState({ data: { runs: [active] } as unknown as Snapshot });
  const finish = beginApiMetric('/cards', 'POST', { description: 'secret' });
  useDevicePreferences.setState({ diagnostics: false });
  vi.setSystemTime(new Date('2026-10-12T00:00:03Z'));
  useDevicePreferences.setState({ diagnostics: true });
  finish('success');
  useWorkspaceStore.setState({
    data: {
      runs: [{ ...active, status: 'completed', finishedAt: '2026-10-12T00:00:03Z' }],
    } as unknown as Snapshot,
  });
  expect(captureDiagnostic).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
  const next = beginApiMetric('/cards', 'POST', {});
  next('success');
  expect(captureDiagnostic).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledTimes(1);
  stop();
  beginApiMetric('/cards', 'POST', {})('success');
  expect(captureDiagnostic).toHaveBeenCalledTimes(1);
  await Promise.resolve();
});

it('master consent aborts native sends immediately without waiting for React effects', async () => {
  const send = vi.fn().mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal('fetch', send);
  const stop = installApplicationMetrics({
    token: 'phc_fictional',
    host: 'https://eu.i.posthog.com',
  });
  beginApiMetric('/cards', 'POST', {})('success');
  expect(send).toHaveBeenCalledTimes(1);
  const signal = send.mock.calls[0][1].signal as AbortSignal;
  expect(signal.aborted).toBe(false);
  useDevicePreferences.setState({ analytics: false });
  expect(signal.aborted).toBe(true);
  beginApiMetric('/cards', 'POST', {})('success');
  expect(send).toHaveBeenCalledTimes(1);
  stop();
});

it('gates run observations on the shared leader while keeping deliberate requests per renderer', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-12T00:00:01Z'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response()));
  const stop = installApplicationMetrics(
    { token: 'phc_fictional', host: 'https://eu.i.posthog.com' },
    () => false,
  );
  vi.setSystemTime(new Date('2026-10-12T00:00:02Z'));
  const active = {
    id: 'local-only',
    status: 'running',
    mode: 'chat',
    startedAt: '2026-10-12T00:00:02Z',
    finishedAt: null,
  };
  useWorkspaceStore.setState({ data: { runs: [active] } as unknown as Snapshot });
  useWorkspaceStore.setState({
    data: {
      runs: [{ ...active, status: 'completed', finishedAt: '2026-10-12T00:00:02Z' }],
    } as unknown as Snapshot,
  });
  expect(captureDiagnostic).not.toHaveBeenCalled();
  beginApiMetric('/cards', 'POST', {})('success');
  expect(captureDiagnostic).toHaveBeenCalledTimes(1);
  expect(captureDiagnostic.mock.calls[0][0]).toBe('api_request_finished');
  stop();
  await Promise.resolve();
});
