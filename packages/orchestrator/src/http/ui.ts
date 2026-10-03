import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultUiRoot = fileURLToPath(new URL('../../../ui/', import.meta.url));

export async function registerUi(app: FastifyInstance, dev: boolean, uiRoot = defaultUiRoot) {
  if (dev) {
    const [{ default: middie }, { createServer }] = await Promise.all([
      import('@fastify/middie'),
      import('vite'),
    ]);
    const vite = await createServer({
      root: uiRoot,
      server: { middlewareMode: true, ws: { server: app.server } },
      appType: 'spa',
    });
    // Close upgraded HMR sockets before Fastify waits for the HTTP server to close.
    app.addHook('preClose', async () => vite.close());
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
        .send('Build the UI with pnpm build, then pnpm start.');
    }
  });
}
