import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where a development daemon keeps Vite's optimized dependencies.
 *
 * `persistent` (the CLI default) reuses one cache per resolved data folder. The daemon lock already
 * allows only one daemon per data folder, so no other running instance can rewrite or delete it,
 * and restarts keep their warm cache. `temporary` (tests) creates a fresh cache that is removed when
 * the daemon closes. Both live under the UI package's `node_modules/.vite`, which Vite already serves.
 */
export interface DevUiCache {
  dataDirectory: string;
  lifecycle?: 'persistent' | 'temporary';
}

const temporaryPrefix = 'pitchcrew-temporary-';
const persistentPrefix = 'pitchcrew-daemon-';
/** Temporary caches left behind by a crashed test daemon are swept after a day. */
const staleTemporaryAge = 24 * 60 * 60 * 1000;
const settlePoll = 200;
const settleQuiet = 1000;
const settleLimit = 15_000;
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Names, sizes and times of everything in the cache, or null while it is mid-optimization. */
const cacheSignature = async (directory: string) => {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true }).catch(
    () => [],
  );
  if (entries.some((entry) => entry.isDirectory() && entry.name.includes('_temp_'))) return null;
  const parts = await Promise.all(
    entries.map(async (entry) => {
      const path = join(entry.parentPath, entry.name);
      const info = await stat(path).catch(() => null);
      return `${path}:${info?.size ?? '-'}:${info?.mtimeMs ?? '-'}`;
    }),
  );
  return parts.sort().join('|');
};

/**
 * Vite has no public "optimizer idle" signal, and closing it mid-run deletes the folder rolldown is
 * still writing. Wait (bounded) until no run is in progress and nothing has changed for a second.
 */
export const settleCache = async (directory: string, limit = settleLimit) => {
  const start = Date.now();
  let last = await cacheSignature(directory);
  let quietSince = Date.now();
  while (Date.now() - start < limit) {
    if (last !== null && Date.now() - quietSince >= settleQuiet) return true;
    await pause(settlePoll);
    const next = await cacheSignature(directory);
    if (next === null || next !== last) quietSince = Date.now();
    last = next;
  }
  return false;
};

/** True only for a direct child of `base` named with `prefix`, after resolving both paths. */
export const ownedCacheDirectory = (base: string, target: string, prefix: string) => {
  const root = resolve(base);
  const path = resolve(target);
  const fromRoot = relative(root, path);
  return (
    fromRoot.length > 0 &&
    !isAbsolute(fromRoot) &&
    !fromRoot.startsWith('..') &&
    dirname(path) === root &&
    basename(path).startsWith(prefix)
  );
};

const removeOwned = async (base: string, target: string) => {
  if (!ownedCacheDirectory(base, target, temporaryPrefix))
    throw new Error('Refusing to remove a directory outside the temporary UI cache boundary.');
  await rm(resolve(target), { recursive: true, force: true });
};

/** Removes a temporary cache, then once more if a late optimizer write recreated it. */
const removeTemporary = async (base: string, target: string) => {
  await removeOwned(base, target);
  await pause(settlePoll);
  if (await stat(target).catch(() => null)) await removeOwned(base, target);
};

const sweepStaleTemporary = async (base: string) => {
  const entries = await readdir(base, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(temporaryPrefix))
      .map(async (entry) => {
        const path = join(base, entry.name);
        const info = await stat(path).catch(() => null);
        if (info && Date.now() - info.mtimeMs > staleTemporaryAge)
          await removeOwned(base, path).catch(() => undefined);
      }),
  );
};

/** Resolves (and for temporary caches creates) this instance's Vite cache directory. */
export const prepareDevUiCache = async (uiRoot: string, cache: DevUiCache) => {
  const base = resolve(uiRoot, 'node_modules', '.vite');
  await mkdir(base, { recursive: true });
  if (cache.lifecycle === 'temporary') {
    await sweepStaleTemporary(base);
    const directory = await mkdtemp(join(base, temporaryPrefix));
    return {
      directory,
      settle: () => settleCache(directory),
      dispose: () => removeTemporary(base, directory),
    };
  }
  const key = createHash('sha256').update(resolve(cache.dataDirectory)).digest('hex').slice(0, 16);
  return {
    directory: join(base, `${persistentPrefix}${key}`),
    settle: async () => true,
    dispose: async () => undefined,
  };
};

export const registerUi = async (
  app: FastifyInstance,
  dev: boolean,
  uiRoot = defaultUiRoot,
  cache?: DevUiCache,
) => {
  if (dev) {
    const [{ default: middie }, { createServer }] = await Promise.all([
      import('@fastify/middie'),
      import('vite'),
    ]);
    const cacheDirectory = cache ? await prepareDevUiCache(uiRoot, cache) : undefined;
    let vite: Awaited<ReturnType<typeof createServer>>;
    try {
      vite = await createServer({
        root: uiRoot,
        // Concurrent development daemons must never share, invalidate or delete one another's
        // optimized dependencies; a shared cache made lazy screens fail with 504 responses.
        ...(cacheDirectory ? { cacheDir: cacheDirectory.directory } : {}),
        server: { middlewareMode: true, ws: { server: app.server } },
        appType: 'spa',
      });
    } catch (error) {
      await cacheDirectory?.dispose();
      throw error;
    }
    // Close upgraded HMR sockets before Fastify waits for the HTTP server to close. A temporary
    // cache first lets an in-flight dependency optimization finish so removal cannot race it.
    app.addHook('preClose', async () => {
      await cacheDirectory?.settle();
      await vite.close();
    });
    if (cacheDirectory) app.addHook('onClose', async () => cacheDirectory.dispose());
    await app.register(middie);
    app.use((req, res, next) => {
      if (req.url?.split('?')[0].startsWith('/api/')) return next();
      vite.middlewares(req, res, next);
    });
  } else {
    await app.register(fastifyStatic, { root: join(uiRoot, 'dist') });
  }
  app.setNotFoundHandler(async (req, res) => {
    if (req.url.split('?')[0].startsWith('/api/') || !['GET', 'HEAD'].includes(req.method))
      return res.status(404).send({ error: 'Route not found.' });
    try {
      return res.type('text/html').send(await readFile(join(uiRoot, 'dist/index.html'), 'utf8'));
    } catch {
      return res
        .status(503)
        .type('text/plain')
        .send('Build the UI with bun run build, then bun run start.');
    }
  });
};

const defaultUiRoot = fileURLToPath(new URL('../../../ui/', import.meta.url));
