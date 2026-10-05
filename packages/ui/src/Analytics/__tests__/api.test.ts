import { afterEach, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => vi.fn());
vi.mock('../client.ts', () => ({ analytics: { capture } }));
import { api } from '../../api.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('captures a successful API mutation once and excludes its request and response content', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'private-id', company: 'Private' }))),
  );
  const result = await api('/cards', 'POST', { company: 'Private', description: 'Sensitive' });
  expect(result).toEqual({ id: 'private-id', company: 'Private' });
  expect(capture).toHaveBeenCalledExactlyOnceWith('job_created', undefined);
});

it('does not count failed mutations or snapshot polling as successful usage', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Private failure' }), { status: 400 }),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ cards: [] })));
  vi.stubGlobal('fetch', fetch);
  await expect(api('/cards', 'POST', { company: 'Private' })).rejects.toThrow('Private failure');
  await api('/snapshot');
  expect(capture).not.toHaveBeenCalled();
});
