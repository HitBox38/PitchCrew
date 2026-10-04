import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import type { ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { registerJsonBody } from './http/body.ts';
import { registerChatStream } from './http/chat-stream.ts';
import { registerAgentRoutes } from './http/routes/agent.ts';
import { registerApprovalsRoutes } from './http/routes/approvals.ts';
import { registerBoardRoutes } from './http/routes/board.ts';
import { registerConnectorsRoutes } from './http/routes/connectors.ts';
import { registerCrewRoutes } from './http/routes/crew.ts';
import { registerSkillsRoutes } from './http/routes/skills.ts';
import { registerProfileSourcesRoutes } from './http/routes/profile-sources.ts';
import { registerSessionSecurity } from './http/security.ts';
import { registerRoutinesRoutes } from './http/routes/routines.ts';
import { registerTrackingRoutes } from './http/routes/tracking.ts';
import { registerOnboardingRoutes } from './http/routes/onboarding.ts';
import { registerPacketRulesRoutes } from './http/routes/packet-rules.ts';
import { registerUi } from './http/ui.ts';
import { CrewService, ensureDirectory } from './service.ts';

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
    options.dev ?? false,
  );
  const app = Fastify({ bodyLimit: 1024 * 1024, forceCloseConnections: true });
  const http = app.server;
  const sessions = new Set<string>();
  const chatStreams = new Set<ServerResponse>();
  http.once('listening', () => service.startScheduler());
  app.addHook('preClose', async () => {
    for (const stream of chatStreams) stream.destroy();
    await service.close();
  });
  app.setErrorHandler((error, _req, res) => {
    if (res.raw.headersSent) return;
    return res
      .status(400)
      .send({ error: error instanceof Error ? error.message : 'Request failed.' });
  });
  try {
    await service.initialize(options.seedSkills ?? true);
    await app.register(cookie);
    registerSessionSecurity(app, options, url, sessions);
    registerJsonBody(app);
    app.get('/api/health', () => ({ app: 'pitchcrew', version: '0.1.0' }));
    app.get('/api/snapshot', async () => service.snapshot());
    registerChatStream(app, service, chatStreams);
    for (const registerRoutes of [
      registerAgentRoutes,
      registerBoardRoutes,
      registerOnboardingRoutes,
      registerPacketRulesRoutes,
      registerTrackingRoutes,
      registerProfileSourcesRoutes,
      registerCrewRoutes,
      registerSkillsRoutes,
      registerRoutinesRoutes,
      registerConnectorsRoutes,
      registerApprovalsRoutes,
    ])
      app.register(async (routes) => registerRoutes(routes, service));
    await registerUi(app, options.dev ?? false);
    // Callers retain the Node server contract; every plugin is ready before listen().
    await app.ready();
    return { app, http, service, url, close: () => app.close() };
  } catch (error) {
    await app.close();
    throw error;
  }
}
