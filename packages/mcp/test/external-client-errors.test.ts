import { afterEach, expect, it, vi } from 'vitest';
import { createExternalClient } from '../src/external/client.ts';

afterEach(() => vi.unstubAllGlobals());

it('explains receipt reconciliation only for identified sends after a lost response', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('Connection lost');
    }),
  );
  const call = createExternalClient('http://127.0.0.1:4417', {
    token: 'a'.repeat(64),
    write: true,
  });
  for (const [input, identified] of [
    [{ conversationId: 'scout', content: 'Hello' }, false],
    [
      {
        conversationId: 'scout',
        content: 'Hello',
        clientRequestId: '67e04b45-07ab-4bb5-bacc-94d9788f708c',
      },
      true,
    ],
  ] as const) {
    const result = await call('send_message', input);
    expect(result.isError).toBe(true);
    const message = JSON.stringify(result.content);
    expect(message).toContain('reconnect this app');
    expect(message.includes('pitchcrew_read_message_receipt')).toBe(identified);
    expect(message).not.toContain('a'.repeat(64));
  }
});
