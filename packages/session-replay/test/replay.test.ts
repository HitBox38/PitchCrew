import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReplay } from '@pitchcrew/session-replay';
import { sanitizeReplayEvent, sanitizeReplayProperties } from '../src/privacy.ts';

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
});
