import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import type { ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { registerJsonBody } from './http/body.ts';
import { registerAnalyticsRoutes, type AnalyticsConfig } from './http/analytics.ts';
import { registerChatStream } from './http/chat-stream.ts';
import { registerAgentRoutes } from './http/routes/agent.ts';
import { registerApprovalsRoutes } from './http/routes/approvals.ts';
import { registerBoardRoutes } from './http/routes/board.ts';
import { registerConnectorsRoutes } from './http/routes/connectors.ts';
import { registerCrewRoutes } from './http/routes/crew.ts';
import { registerSkillsRoutes } from './http/routes/skills.ts';
import { registerProfileSourcesRoutes } from './http/routes/profile-sources.ts';
import { registerJobSourcesRoutes } from './http/routes/job-sources.ts';
import { registerSessionSecurity } from './http/security.ts';
import { registerRoutinesRoutes } from './http/routes/routines.ts';
import { registerTrackingRoutes } from './http/routes/tracking.ts';
import { registerLearningRoutes } from './http/routes/learning.ts';
import { registerOnboardingRoutes } from './http/routes/onboarding.ts';
import { registerPacketRulesRoutes } from './http/routes/packet-rules.ts';
import { registerUi } from './http/ui.ts';
import { registerBackgroundServiceRoutes } from './http/routes/background-service.ts';
import { CrewService, ensureDirectory } from './service.ts';
import { acquireDaemonLock, type LockChecks } from './background/lock.ts';
import type { BackgroundServiceStatus } from '@pitchcrew/core';

export interface DaemonOptions {
  directory: string;
  port: number;
  dev?: boolean;
  seedSkills?: boolean;
  /** Started by the installed background service. */
  service?: boolean;
  /** Reads the OS background service; tests replace it so no service manager is called. */
  backgroundService?: () => Promise<BackgroundServiceStatus>;
  lockChecks?: LockChecks;
  /** Public PostHog configuration; omitted in tests and unconfigured installations. */
  analytics?: AnalyticsConfig | null;
}

export async function createDaemon(options: DaemonOptions) {
  await ensureDirectory(options.directory);
  // Claim the data folder before opening the board, so a second daemon cannot recover its runs.
  const lock = await acquireDaemonLock(
    options.directory,
    { port: options.port, service: options.service ?? false },
    options.lockChecks,
  );
  try {
    return await startDaemon(options, lock.release);
  } catch (error) {
    await lock.release();
    throw error;
  }
}

async function startDaemon(options: DaemonOptions, releaseLock: () => Promise<void>) {
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
    // Node listen() does not set Fastify's listening flag, so its forced cleanup is skipped.
    // Stop accepting first, then close HTTP connections; Vite closes upgraded HMR sockets.
    http.close();
    http.closeAllConnections();
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
    registerSessionSecurity(
      app,
      { ...options, analyticsHost: options.analytics?.host },
      url,
      sessions,
    );
    registerJsonBody(app);
    app.get('/api/health', () => ({
      app: 'pitchcrew',
      version: '0.1.0',
      service: options.service ?? false,
    }));
    app.get('/api/snapshot', async () => service.snapshot());
    registerAnalyticsRoutes(app, options.analytics);
    registerChatStream(app, service, chatStreams);
    for (const registerRoutes of [
      registerAgentRoutes,
      registerBoardRoutes,
      registerOnboardingRoutes,
      registerPacketRulesRoutes,
      registerTrackingRoutes,
      registerLearningRoutes,
      registerProfileSourcesRoutes,
      registerJobSourcesRoutes,
      registerCrewRoutes,
      registerSkillsRoutes,
      registerRoutinesRoutes,
      registerConnectorsRoutes,
      registerApprovalsRoutes,
    ])
      app.register(async (routes) => registerRoutes(routes, service));
    app.register(async (routes) => registerBackgroundServiceRoutes(routes, options));
    await registerUi(app, options.dev ?? false);
    // Callers retain the Node server contract; every plugin is ready before listen().
    await app.ready();
    const close = async () => {
      try {
        await app.close();
      } finally {
        await releaseLock();
      }
    };
    return { app, http, service, url, close };
  } catch (error) {
    await app.close();
    throw error;
  }
}
