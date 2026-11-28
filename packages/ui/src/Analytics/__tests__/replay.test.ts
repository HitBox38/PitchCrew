import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnalytics } from '../client.ts';

const secret = 'PRIVATE_ada@example.test_/Users/ada/resume_Company42';
const snapshot = {
  type: 2,
  timestamp: 1900000000000,
  data: {
    node: { type: 3, id: 1, textContent: secret },
    initialOffset: { top: 0, left: 0 },
  },
};
afterEach(() => vi.useRealTimers());

describe('app replay transport', () => {
  it('updates the transport project on configuration replacement without importing when disabled', async () => {
    const sdk = {
      init: vi.fn(),
      set_config: vi.fn(),
      capture: vi.fn(),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
    };
    const loadRecorder = vi.fn();
    const client = createAnalytics(
      async () => sdk,
      () => true,
      () => false,
      () => false,
      loadRecorder,
    );
    await client.setEnabled(true, { token: 'first', host: 'https://eu.i.posthog.com' });
    await client.setEnabled(true, { token: 'second', host: 'https://us.i.posthog.com' });
    expect(sdk.init).toHaveBeenCalledOnce();
    expect(sdk.set_config).toHaveBeenCalledWith({
      token: 'second',
      api_host: 'https://us.i.posthog.com',
    });
    expect(loadRecorder).not.toHaveBeenCalled();
  });
  it('uses the native snapshot endpoint with existing anonymous session IDs and stops on config removal', async () => {
    vi.useFakeTimers();
    let consent = true;
    const cleanup = vi.fn();
    const record = vi.fn((options) => {
      options.emit(snapshot);
      return cleanup;
    });
    const sdk = {
      init: vi.fn(),
      capture: vi.fn(),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
      sessionManager: {
        checkAndGetSessionAndWindowId: () => ({ sessionId: 'session', windowId: 'window' }),
      },
    };
    const client = createAnalytics(
      async () => sdk as unknown as Awaited<ReturnType<Parameters<typeof createAnalytics>[0]>>,
      () => consent,
      () => true,
      () => true,
      async () => ({ record, node: () => null }),
    );
    await client.setEnabled(true, { token: 'fixture', host: 'https://eu.i.posthog.com' });
    await Promise.resolve();
    vi.advanceTimersByTime(5000);
    expect(sdk.capture).toHaveBeenCalledWith(
      '$snapshot',
      expect.objectContaining({ $session_id: 'session', $window_id: 'window' }),
      { _url: 'https://eu.i.posthog.com/s/', _noTruncate: true },
    );
    const beforeSend = sdk.init.mock.calls[0][1].before_send;
    expect(
      JSON.stringify(beforeSend({ event: '$snapshot', properties: sdk.capture.mock.calls[0][1] })),
    ).not.toContain(secret);
    consent = false;
    expect(beforeSend({ event: '$snapshot', properties: sdk.capture.mock.calls[0][1] })).toBeNull();
    await client.setEnabled(true, null);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
