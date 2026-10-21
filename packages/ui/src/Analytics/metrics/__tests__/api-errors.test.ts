import { afterEach, expect, it, vi } from 'vitest';

const finish = vi.hoisted(() => vi.fn());
vi.mock('../runtime.ts', () => ({ beginApiMetric: () => finish }));
vi.mock('../../client.ts', () => ({ analytics: { capture: vi.fn() } }));
import { api } from '../../../api.ts';
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it('preserves an original network or abort exception and records its fixed outcome', async () => {
  const network = new TypeError('private network URL');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(network));
  await expect(api('/cards', 'POST', {})).rejects.toBe(network);
  expect(finish).toHaveBeenLastCalledWith('network_error', undefined);
  const abort = new DOMException('private abort details', 'AbortError');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
  await expect(api('/cards', 'POST', {})).rejects.toBe(abort);
  expect(finish).toHaveBeenLastCalledWith('aborted', undefined);
});

it('preserves HTTP error text locally while measuring failure and parsing errors distinctly', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":"private failure"}', { status: 409 }))
      .mockResolvedValueOnce(new Response('invalid JSON')),
  );
  await expect(api('/cards', 'POST', {})).rejects.toThrow('private failure');
  expect(finish).toHaveBeenLastCalledWith('http_error', 409);
  await expect(api('/cards', 'POST', {})).rejects.toBeInstanceOf(SyntaxError);
  expect(finish).toHaveBeenLastCalledWith('invalid_response', 200);
});
