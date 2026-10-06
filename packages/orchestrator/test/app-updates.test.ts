import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readAppBuild } from '../src/app-updates/build.ts';
import { createAppUpdateChecker } from '../src/app-updates/index.ts';
import { registerAppUpdateRoutes } from '../src/http/routes/app-updates.ts';
import { registerSessionSecurity } from '../src/http/security.ts';

const current = { version: '0.1.0', commit: 'a'.repeat(40), packaged: true };
const latest = 'b'.repeat(40);
const release = { tag_name: `build-${latest}`, draft: false, prerelease: false };
const json = (value: unknown) => new Response(JSON.stringify(value));
const create = (fetcher: typeof fetch, extra = {}) =>
  createAppUpdateChecker({
    enabled: true,
    automatic: true,
    current,
    fetcher,
    ...extra,
  });

describe('public build update checks', () => {
  it('reads installer build identity without Git and rejects malformed metadata', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-build-test-'));
    const root = pathToFileURL(directory + '/');
    try {
      await writeFile(
        join(directory, 'build-info.json'),
        JSON.stringify({ commit: current.commit }),
      );
      expect(await readAppBuild(root)).toEqual(current);
      for (const content of ['{invalid', JSON.stringify({ commit: 'not-a-commit' })]) {
        await writeFile(join(directory, 'build-info.json'), content);
        expect(await readAppBuild(root)).toMatchObject({ commit: null, packaged: false });
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('retains the release link when a local commit cannot be compared on GitHub', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(release))
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    expect(await create(fetcher).check()).toMatchObject({
      status: 'unknown',
      latest: { commit: latest },
    });
  });
  it.each([
    ['ahead', 'available'],
    ['behind', 'current'],
    ['identical', 'current'],
    ['diverged', 'unknown'],
  ])('compares ancestry %s without prompting a downgrade', async (relation, status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(release))
      .mockResolvedValueOnce(json({ status: relation }));
    const checker = create(fetcher);
    expect((await checker.info()).status).toBe('idle');
    expect(fetcher).not.toHaveBeenCalled();
    const result = await checker.check();
    expect(result.status).toBe(status);
    expect(result.latest?.url).toBe(
      `https://github.com/HitBox38/PitchCrew/releases/tag/build-${latest}`,
    );
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://api.github.com/repos/HitBox38/PitchCrew/releases/latest',
      `https://api.github.com/repos/HitBox38/PitchCrew/compare/${current.commit}...${latest}?per_page=1&page=2`,
    ]);
    for (const [, options] of fetcher.mock.calls) {
      expect(options?.redirect).toBe('error');
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      expect(JSON.stringify(options?.headers)).not.toMatch(/authorization|cookie/i);
    }
  });

  it('deduplicates callers, caches hourly and bounds repeated manual requests', async () => {
    let time = Date.parse('2026-10-06T12:00:00Z');
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => json({ ...release, tag_name: `build-${current.commit}` }));
    const checker = create(fetcher, { now: () => time });
    const results = await Promise.all([checker.check(), checker.check(true), checker.check()]);
    expect(results.every((result) => result.status === 'current')).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await checker.check(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    time += 60_000;
    await checker.check();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await checker.check(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    time += 3_600_000;
    await checker.check();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('reports missing identities honestly and disables unconfigured checks', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(release));
    const checker = create(fetcher, { current: { ...current, commit: null } });
    expect((await checker.check()).status).toBe('unknown');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const disabled = create(fetcher, { enabled: false });
    expect(await disabled.check()).toMatchObject({ status: 'disabled', automatic: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    () => Promise.reject(new Error('offline')),
    () => Promise.resolve(new Response('', { status: 403 })),
    () => Promise.resolve(new Response('', { status: 404 })),
    () => Promise.resolve(new Response('{broken')),
    () => Promise.resolve(json({ ...release, draft: true })),
    () => Promise.resolve(json({ ...release, prerelease: true })),
    () => Promise.resolve(json({ ...release, tag_name: 'https://evil.example/' })),
    () => Promise.resolve(new Response('x'.repeat(256_001))),
  ])('handles unavailable and untrusted release responses', async (fetcher) => {
    expect(await create(fetcher).check()).toMatchObject({ status: 'error', latest: null });
  });

  it('aborts active checks on shutdown', async () => {
    let signal: AbortSignal | null | undefined;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => {
      signal = options?.signal;
      return new Promise((_resolve, reject) =>
        signal?.addEventListener('abort', () => reject(new Error('closed'))),
      );
    });
    const checker = create(fetcher);
    const checking = checker.check();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
    checker.close();
    expect(await checking).toMatchObject({ status: 'error' });
    expect(signal?.aborted).toBe(true);
  });
});

it('keeps update status and checks behind the local UI session', async () => {
  const app = Fastify();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(json({ ...release, tag_name: `build-${current.commit}` }));
  await app.register(cookie);
  registerSessionSecurity(app, { port: 4417 }, 'http://127.0.0.1:4417', new Set(['fixture']));
  registerAppUpdateRoutes(app, { enabled: true, automatic: true, current, fetcher });
  const headers = {
    host: '127.0.0.1:4417',
    cookie: 'pitchcrew_session=fixture',
    'x-pitchcrew-client': 'ui',
  };
  try {
    for (const [url, method] of [
      ['/api/app-updates', 'GET'],
      ['/api/app-updates/check', 'POST'],
    ] as const) {
      for (const denied of [
        { host: headers.host },
        { ...headers, origin: 'https://evil.example' },
        { ...headers, host: 'evil.example' },
      ])
        expect((await app.inject({ url, method, headers: denied })).statusCode).toBe(403);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect((await app.inject({ url: '/api/app-updates', headers })).json().status).toBe('idle');
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      (
        await app.inject({ url: '/api/app-updates/check?manual=true', method: 'POST', headers })
      ).json().status,
    ).toBe('current');
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally {
    await app.close();
  }
});
