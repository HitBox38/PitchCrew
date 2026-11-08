import { mkdir, mkdtemp, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ownedCacheDirectory, prepareDevUiCache, settleCache } from '../src/http/ui.ts';
import { cleanup, setup } from './helpers/daemon.ts';

const roots: string[] = [];
const folder = async () => {
  const path = await mkdtemp(join(tmpdir(), 'pitchcrew-ui-cache-'));
  roots.push(path);
  return path;
};
afterEach(async () => {
  await cleanup();
  for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true });
});

describe('development UI dependency cache', () => {
  it('keeps one persistent cache per data folder and never shares Vite’s default cache', async () => {
    const uiRoot = await folder();
    const first = await prepareDevUiCache(uiRoot, { dataDirectory: join(uiRoot, 'home-a') });
    const again = await prepareDevUiCache(uiRoot, { dataDirectory: join(uiRoot, 'home-a') });
    const other = await prepareDevUiCache(uiRoot, { dataDirectory: join(uiRoot, 'home-b') });
    const base = resolve(uiRoot, 'node_modules', '.vite');
    expect(first.directory).toBe(again.directory);
    expect(first.directory).not.toBe(other.directory);
    for (const { directory } of [first, other]) {
      expect(resolve(directory, '..')).toBe(base);
      // Vite's own default deps folder is `<base>/deps`; instance caches must never be it.
      expect(resolve(directory)).not.toBe(join(base, 'deps'));
      expect(directory).not.toContain('_temp_');
    }
    // Persistent caches survive close so restarts keep a warm cache.
    await mkdir(first.directory, { recursive: true });
    await first.dispose();
    expect(existsSync(first.directory)).toBe(true);
  });

  it('removes only its own temporary cache and sweeps stale crashed ones', async () => {
    const uiRoot = await folder();
    const base = resolve(uiRoot, 'node_modules', '.vite');
    await mkdir(join(base, 'deps'), { recursive: true });
    await writeFile(join(base, 'deps', '_metadata.json'), '{}');
    const stale = join(base, 'pitchcrew-temporary-stale');
    const recent = join(base, 'pitchcrew-temporary-recent');
    await mkdir(stale);
    await mkdir(recent);
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await utimes(stale, old, old);
    const a = await prepareDevUiCache(uiRoot, { dataDirectory: 'x', lifecycle: 'temporary' });
    const b = await prepareDevUiCache(uiRoot, { dataDirectory: 'x', lifecycle: 'temporary' });
    expect(a.directory).not.toBe(b.directory);
    expect(existsSync(stale)).toBe(false);
    expect(existsSync(recent)).toBe(true);
    await b.dispose();
    expect(existsSync(b.directory)).toBe(false);
    expect((await stat(a.directory)).isDirectory()).toBe(true);
    // Another instance's cache and Vite's shared folder are untouched.
    expect(existsSync(join(base, 'deps', '_metadata.json'))).toBe(true);
    await a.dispose();
    expect(await readdir(base)).toEqual(expect.arrayContaining(['deps']));
  });

  it('waits for an in-progress optimization before a temporary cache closes', async () => {
    const directory = await folder();
    const running = join(directory, 'deps_temp_abc');
    await mkdir(running);
    const settling = settleCache(directory, 5000);
    await new Promise((done) => setTimeout(done, 600));
    let settled = false;
    void settling.then(() => (settled = true));
    await new Promise((done) => setTimeout(done, 100));
    expect(settled).toBe(false);
    await rm(running, { recursive: true });
    await mkdir(join(directory, 'deps'));
    expect(await settling).toBe(true);
    // A run that never finishes is bounded rather than blocking shutdown.
    await mkdir(running);
    expect(await settleCache(directory, 500)).toBe(false);
  });

  it('accepts only direct, prefixed children of the resolved boundary', () => {
    const base = resolve(tmpdir(), 'ui', 'node_modules', '.vite');
    const prefix = 'pitchcrew-temporary-';
    expect(ownedCacheDirectory(base, join(base, `${prefix}abc`), prefix)).toBe(true);
    expect(ownedCacheDirectory(base, base, prefix)).toBe(false);
    expect(ownedCacheDirectory(base, join(base, 'deps'), prefix)).toBe(false);
    expect(ownedCacheDirectory(base, join(base, `${prefix}a`, 'nested'), prefix)).toBe(false);
    expect(ownedCacheDirectory(base, join(base, '..', `${prefix}abc`), prefix)).toBe(false);
    expect(ownedCacheDirectory(base, join(base, `${prefix}a`, '..', '..', 'x'), prefix)).toBe(
      false,
    );
    expect(ownedCacheDirectory(base, resolve(tmpdir(), `${prefix}abc`), prefix)).toBe(false);
  });

  it('keeps one development daemon’s optimized modules available while another starts and stops', async () => {
    const uiRoot = fileURLToPath(new URL('../../ui/', import.meta.url));
    const sharedDeps = resolve(uiRoot, 'node_modules', '.vite', 'deps');
    const reactModule = async (url: string) => {
      const entry = await fetch(`${url}/src/main.tsx`);
      expect(entry.status).toBe(200);
      const path = (await entry.text()).match(
        /from\s+"(\/node_modules\/\.vite\/[^"]+\/react\.js[^"]*)"/,
      )?.[1];
      expect(path).toBeTruthy();
      return path!;
    };
    const first = await setup(15791, false, { dev: true, ui: 'dev', uiCache: 'temporary' });
    const firstModule = await reactModule(first.daemon.url);
    expect(firstModule).toMatch(/\/pitchcrew-temporary-[^/]+\/deps\//);
    const firstCache = resolve(uiRoot, firstModule.slice(1).split('/deps/')[0]);
    expect(resolve(firstCache, 'deps')).not.toBe(sharedDeps);

    const second = await setup(15792, false, { dev: true, ui: 'dev', uiCache: 'temporary' });
    const secondModule = await reactModule(second.daemon.url);
    const secondCache = resolve(uiRoot, secondModule.slice(1).split('/deps/')[0]);
    expect(secondCache).not.toBe(firstCache);
    await second.daemon.close();
    expect(existsSync(secondCache)).toBe(false);

    // The first instance still serves real optimized dependencies, not 504 Outdated Optimize Dep.
    const current = await reactModule(first.daemon.url);
    const dependency = await fetch(`${first.daemon.url}${current}`);
    expect(dependency.status).toBe(200);
    expect((await dependency.text()).length).toBeGreaterThan(100);
    expect(existsSync(firstCache)).toBe(true);
    await first.daemon.close();
    expect(existsSync(firstCache)).toBe(false);
  }, 180_000);
});
