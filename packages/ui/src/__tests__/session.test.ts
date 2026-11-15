import { afterEach, expect, it, vi } from 'vitest';
import { sessionFetch } from '../session.ts';

afterEach(() => vi.unstubAllGlobals());

const expired = () =>
  new Response(JSON.stringify({ error: 'Open Pitchcrew in the browser.' }), {
    status: 403,
    headers: { 'x-pitchcrew-session': 'required' },
  });

it('renews a forgotten session once and retries the request', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(expired())
    .mockResolvedValueOnce(new Response('<html></html>'))
    .mockResolvedValueOnce(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  const response = await sessionFetch('/api/cards', { method: 'POST', body: '{}' });
  expect(response.status).toBe(200);
  expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/api/cards', '/', '/api/cards']);
  expect(fetch.mock.calls[2][1]).toMatchObject({
    method: 'POST',
    body: '{}',
    headers: { 'x-pitchcrew-client': 'ui' },
  });
});

it('shares one renewal between concurrent requests and never retries twice', async () => {
  const fetch = vi.fn((path: string) =>
    Promise.resolve(path === '/' ? new Response('') : expired()),
  );
  vi.stubGlobal('fetch', fetch);
  const responses = await Promise.all([sessionFetch('/api/a'), sessionFetch('/api/b')]);
  expect(responses.map((response) => response.status)).toEqual([403, 403]);
  expect(fetch.mock.calls.filter(([path]) => path === '/')).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(5);
});

it('leaves other 403 responses alone', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ error: 'Cross-origin' }), { status: 403 }));
  vi.stubGlobal('fetch', fetch);
  expect((await sessionFetch('/api/cards')).status).toBe(403);
  expect(fetch).toHaveBeenCalledTimes(1);
});
