import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReplay } from '../replay/recorder.ts';
import { sanitizeReplayEvent, sanitizeReplayProperties } from '../replay/privacy.ts';
import { createAnalytics } from '../client.ts';
import { replayAllowed, replayPreferenceKey } from '../../../../landing/src/Analytics/helpers';

const secret = 'PRIVATE_ada@example.test_/Users/ada/resume_Company42';
const timestamp = 1900000000000;
const snapshot = {
  type: 2,
  timestamp,
  data: {
    node: {
      type: 0,
      id: 1,
      childNodes: [
        {
          type: 2,
          id: 2,
          tagName: 'a',
          attributes: {
            href: secret,
            id: secret,
            class: secret,
            'aria-label': secret,
            value: secret,
            title: secret,
            style: `background:url(${secret})`,
          },
          childNodes: [{ type: 3, id: 3, textContent: secret }],
        },
        {
          type: 2,
          id: 4,
          tagName: 'script',
          attributes: { src: secret },
          childNodes: [{ type: 3, id: 5, textContent: secret }],
        },
      ],
    },
    initialOffset: { top: 0, left: 0, secret },
  },
};
const mutations = {
  type: 3,
  timestamp,
  data: {
    source: 0,
    texts: [{ id: 3, value: secret }],
    attributes: [
      { id: 2, attributes: { href: secret, id: secret, value: secret, 'aria-label': secret } },
    ],
    adds: [
      {
        parentId: 1,
        nextId: null,
        node: {
          type: 2,
          id: 6,
          tagName: secret,
          attributes: { src: secret },
          childNodes: [{ type: 3, id: 7, textContent: secret }],
        },
      },
    ],
    removes: [],
    secret,
  },
};
afterEach(() => vi.useRealTimers());

describe('wireframe replay privacy', () => {
  it('rebuilds full snapshots, mutations and metadata without source content or attributes', () => {
    const payload = sanitizeReplayProperties({
      $snapshot_data: [
        snapshot,
        mutations,
        { type: 4, timestamp, data: { href: secret, width: 800, height: 600 } },
      ],
      $current_url: secret,
      body: secret,
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(secret);
    for (const key of ['aria-label', 'href":"PRIVATE', 'title', 'value":"PRIVATE', 'src', 'class'])
      expect(serialized).not.toContain(key);
    expect(serialized).toContain('[masked]');
    expect(serialized).toContain('pitchcrew.invalid');
    expect(payload?.$snapshot_data).toHaveLength(3);
  });
  it('rejects all unknown and content-bearing incremental and plugin data', () => {
    for (const source of [5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 99])
      expect(
        sanitizeReplayEvent({ type: 3, timestamp, data: { source, text: secret } }),
      ).toBeNull();
    for (const type of [5, 6, 99])
      expect(sanitizeReplayEvent({ type, timestamp, data: secret })).toBeNull();
    expect(sanitizeReplayProperties({ $snapshot_data: [secret] })).toBeNull();
  });
  it('makes website replay separately opt-in and respects master opt-out and DNT', () => {
    const storage = { getItem: vi.fn((_key: string) => null as string | null) };
    expect(replayAllowed(storage, null)).toBe(false);
    storage.getItem.mockImplementation((key) => (key === replayPreferenceKey ? 'on' : null));
    expect(replayAllowed(storage, null)).toBe(true);
    expect(replayAllowed(storage, '1')).toBe(false);
    storage.getItem.mockImplementation((key) => (key === replayPreferenceKey ? 'on' : 'off'));
    expect(replayAllowed(storage, null)).toBe(false);
  });
  it('drops a pending import and clears recording buffers immediately on opt-out', async () => {
    vi.useFakeTimers();
    let consent = true;
    let resolve!: (value: Awaited<ReturnType<Parameters<typeof createReplay>[0]>>) => void;
    const record = vi.fn(() => vi.fn());
    const send = vi.fn();
    const replay = createReplay(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
      () => consent,
      send,
    );
    const pending = replay.setEnabled(true);
    consent = false;
    replay.stop();
    resolve({ record, node: () => null });
    await pending;
    expect(record).not.toHaveBeenCalled();
    const cleanup = vi.fn();
    const emitRecord = vi.fn((options) => {
      options.emit(snapshot);
      return cleanup;
    });
    consent = true;
    const active = createReplay(
      async () => ({ record: emitRecord, node: () => null }),
      () => consent,
      send,
    );
    await active.setEnabled(true);
    consent = false;
    active.stop();
    vi.advanceTimersByTime(10000);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });
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
