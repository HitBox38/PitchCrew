import { roleIds } from '@pitchcrew/core';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { registerChatStream } from './http/chat-stream.ts';
import { registerApprovalsRoutes } from './http/routes/approvals.ts';
import { registerBoardRoutes } from './http/routes/board.ts';
import { registerConnectorsRoutes } from './http/routes/connectors.ts';
import { registerCrewRoutes } from './http/routes/crew.ts';
import { registerSkillsRoutes } from './http/routes/skills.ts';
import { registerProfileSourcesRoutes } from './http/routes/profile-sources.ts';
import { registerSessionSecurity } from './http/security.ts';
import { CrewService, ensureDirectory } from './service.ts';

const uiRoot = fileURLToPath(new URL('../../ui/', import.meta.url));
export async function createDaemon(options: {
  directory: string;
  port: number;
  dev?: boolean;
  seedSkills?: boolean;
}) {
  await ensureDirectory(options.directory);
  const url = `http://127.0.0.1:${options.port}`;
  const service = new CrewService(
    options.directory,
    url,
    fileURLToPath(new URL('../../mcp/src/cli.ts', import.meta.url)),
  );
  await service.initialize(options.seedSkills ?? true);
  const app = express();
  app.disable('x-powered-by');
  const sessions = new Set<string>();
  const chatStreams = new Set<express.Response>();
  const http = createServer(app);
  registerSessionSecurity(app, options, url, sessions);
  app.use(express.json({ limit: '1mb' }));
  app.get('/api/health', (_req, res) => res.json({ app: 'pitchcrew', version: '0.1.0' }));
  app.get('/api/snapshot', async (_req, res) => res.json(await service.snapshot()));
  // Fetch-based SSE preserves the UI session cookie AND custom client header.
  registerChatStream(app, service, chatStreams);
  registerBoardRoutes(app, service);
  registerProfileSourcesRoutes(app, service);

  registerCrewRoutes(app, service);
  registerSkillsRoutes(app, service);

  registerConnectorsRoutes(app, service);

  registerApprovalsRoutes(app, service);

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
        kind: z.enum(['message', 'attention']).optional(),
        mode: z.enum(['chat', 'workflow']).optional(),
        reason: z.string().max(2000).optional(),
        changes: z.unknown().optional(),
        suggestion: z.unknown().optional(),
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
