import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { z } from 'zod';
import { roleIds, runtimeIds, states } from '@pitchcrew/core';
import { CrewService, ensureDirectory } from './service.ts';
const uiRoot = fileURLToPath(new URL('../../ui/', import.meta.url));
export async function createDaemon(options: { directory: string; port: number; dev?: boolean }) {
  await ensureDirectory(options.directory);
  const url = `http://127.0.0.1:${options.port}`;
  const service = new CrewService(
    options.directory,
    url,
    fileURLToPath(new URL('../../mcp/src/cli.ts', import.meta.url)),
  );
  await service.initialize();
  const app = express();
  app.disable('x-powered-by');
  const sessions = new Set<string>();
  const chatStreams = new Set<express.Response>();
  const http = createServer(app);
  app.use((req, res, next) => {
    if (req.headers.host !== `127.0.0.1:${options.port}`) {
      res.status(403).json({ error: 'Use the loopback address printed by Pitchcrew.' });
      return;
    }
    if (
      (req.headers.origin && req.headers.origin !== url) ||
      req.headers['sec-fetch-site'] === 'cross-site'
    ) {
      res.status(403).json({ error: 'Cross-origin access is not allowed.' });
      return;
    }
    if (!options.dev)
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.path === '/api/health' || req.path === '/api/agent') {
      next();
      return;
    }
    const cookie = req.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('pitchcrew_session='))
      ?.slice('pitchcrew_session='.length);
    if (req.path.startsWith('/api/')) {
      if (!cookie || !sessions.has(cookie) || req.headers['x-pitchcrew-client'] !== 'ui') {
        res.status(403).json({ error: 'Open Pitchcrew in the browser to start a local session.' });
        return;
      }
    } else if (!cookie || !sessions.has(cookie)) {
      const token = randomUUID();
      sessions.add(token);
      res.cookie('pitchcrew_session', token, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 86400000,
      });
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.get('/api/health', (_req, res) => res.json({ app: 'pitchcrew', version: '0.1.0' }));
  app.get('/api/snapshot', async (_req, res) => res.json(await service.snapshot()));
  // Fetch-based SSE preserves the UI session cookie AND custom client header.
  app.get('/api/chat/stream', (_req, res) => {
    chatStreams.add(res);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.flushHeaders();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let blocked = false;
    let messagesChanged = true;
    const send = () => {
      timer = undefined;
      if (blocked || res.destroyed) return;
      blocked = !res.write(`data: ${JSON.stringify(service.chatUpdate(messagesChanged))}\n\n`);
      messagesChanged = false;
    };
    // Coalesce fast token bursts, and retain only the latest state for slow clients.
    const schedule = () => {
      if (!timer && !blocked && !res.destroyed) timer = setTimeout(send, 40);
    };
    const unsubscribe = service.subscribeChat((changed) => {
      messagesChanged ||= changed;
      schedule();
    });
    res.on('drain', () => {
      blocked = false;
      schedule();
    });
    const heartbeat = setInterval(() => {
      if (!blocked && !res.destroyed) blocked = !res.write(': heartbeat\n\n');
    }, 15000);
    res.on('close', () => {
      chatStreams.delete(res);
      unsubscribe();
      clearTimeout(timer);
      clearInterval(heartbeat);
    });
    send();
  });
  app.post('/api/cards', (req, res) => res.status(201).json(service.createCard(req.body)));
  app.post('/api/cards/:id/move', (req, res) =>
    res.json(
      service.moveCard(req.params.id, z.object({ state: z.enum(states) }).parse(req.body).state),
    ),
  );
  app.post('/api/cards/:id/run', async (req, res) =>
    res
      .status(202)
      .json(
        await service.startRun(
          req.params.id,
          z.object({ roleId: z.enum(roleIds) }).parse(req.body).roleId,
        ),
      ),
  );
  app.post('/api/runs/:id/cancel', (req, res) => {
    service.cancelRun(req.params.id);
    res.json({ ok: true });
  });
  app.put('/api/roles/:id', async (req, res) =>
    res.json(await service.configureRole(z.enum(roleIds).parse(req.params.id), req.body)),
  );
  app.post('/api/roles/:id/chat', async (req, res) =>
    res.status(202).json(await service.sendChat(z.enum(roleIds).parse(req.params.id), req.body)),
  );
  app.post('/api/proposals/:id/decide', async (req, res) =>
    res.json(
      await service.decideProposal(
        req.params.id,
        z.object({ approved: z.boolean() }).parse(req.body).approved,
      ),
    ),
  );
  app.post('/api/runtimes/detect', async (_req, res) => res.json(await service.detect()));
  app.post('/api/runtimes/:id/models', async (req, res) => {
    const { refresh } = z.object({ refresh: z.boolean().default(false) }).parse(req.body ?? {});
    res.json(await service.runtimeModels(z.enum(runtimeIds).parse(req.params.id), refresh));
  });
  app.post('/api/connectors/github/connect', async (req, res) =>
    res.json(await service.connectors.connectGithub(req.body)),
  );
  app.post('/api/connectors/google/connect', async (req, res) =>
    res.json(await service.connectors.connectGoogle(req.body)),
  );
  app.post('/api/connectors/:id/disconnect', async (req, res) =>
    res.json(
      await service.connectors.disconnect(z.enum(['github', 'google']).parse(req.params.id)),
    ),
  );
  app.put('/api/profile', async (req, res) => {
    const body = z
      .object({ name: z.string().max(100), content: z.string().max(50000) })
      .parse(req.body);
    res.json(await service.saveProfile(body.name, body.content));
  });
  app.post('/api/examples', async (_req, res) => {
    await service.loadExamples();
    res.json({ ok: true });
  });
  app.post('/api/cards/:id/approval', (req, res) =>
    res.status(201).json(service.board.requestApproval(req.params.id)),
  );
  app.post('/api/approvals/:id/decide', (req, res) =>
    res.json(
      service.board.decideApproval(
        req.params.id,
        z.object({ approved: z.boolean() }).parse(req.body).approved,
      ),
    ),
  );
  app.post('/api/approvals/:id/export', async (req, res) =>
    res.json({ directory: await service.exportPacket(req.params.id) }),
  );
  app.post('/api/agent', async (req, res) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    if (!service.capabilities.has(token)) {
      res.status(403).json({ error: 'Invalid or expired run capability.' });
      return;
    }
    const body = z
      .object({
        action: z.string(),
        packet: z.unknown().optional(),
        approvalId: z.uuid().optional(),
        beforeEventId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        roleId: z.enum(roleIds).optional(),
        content: z.string().max(8000).optional(),
        mode: z.enum(['chat', 'workflow']).optional(),
        reason: z.string().max(2000).optional(),
        changes: z.unknown().optional(),
        state: z.enum(['shortlisted', 'changes_requested']).optional(),
        tool: z.string().max(100).optional(),
        input: z.unknown().optional(),
      })
      .parse(req.body);
    res.json(await service.agentCall(token, body.action, body));
  });
  let vite: Awaited<ReturnType<(typeof import('vite'))['createServer']>> | undefined;
  if (options.dev) {
    const { createServer: createVite } = await import('vite');
    vite = await createVite({
      root: uiRoot,
      server: { middlewareMode: true, ws: { server: http } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(join(uiRoot, 'dist')));
    app.get('/{*path}', async (_req, res) => {
      try {
        res.type('html').send(await readFile(join(uiRoot, 'dist/index.html'), 'utf8'));
      } catch {
        res.status(503).send('Build the UI with pnpm build, then pnpm start.');
      }
    });
  }
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (res.headersSent) return;
      res.status(400).json({ error: error instanceof Error ? error.message : 'Request failed.' });
    },
  );
  return {
    app,
    http,
    service,
    url,
    async close() {
      for (const stream of chatStreams) stream.destroy();
      await service.close();
      await vite?.close();
      await new Promise<void>((resolve, reject) => {
        if (!http.listening) {
          resolve();
          return;
        }
        http.close((error) => (error ? reject(error) : resolve()));
        http.closeAllConnections();
      });
    },
  };
}
