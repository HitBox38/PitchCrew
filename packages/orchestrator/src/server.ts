import { registerRuntimeMaintenanceRoutes } from './http/routes/runtime-maintenance.ts';
import { registerSnapshot } from './http/snapshot.ts';
import { registerExternalMcpRoutes } from './http/routes/external-mcp.ts';
import { failureCategory } from '@pitchcrew/core/operational-logs';
import { recordOperationalLog } from './telemetry/logs.ts';
import type { BrowserDriver } from '@pitchcrew/mcp/computer';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import type { ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { registerJsonBody } from './http/body.ts';
import { registerAnalyticsRoutes, type AnalyticsConfig } from './http/analytics.ts';
import { registerChatStream } from './http/chat-stream.ts';
import { registerAgentRoutes } from './http/routes/agent.ts';
import { registerQualityRoutes } from './http/routes/quality.ts';
import { registerApprovalsRoutes } from './http/routes/approvals.ts';
import { registerBrowserRoutes } from './http/routes/browser.ts';
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
import type { AppUpdateOptions } from './app-updates/index.ts';
import { registerAppUpdateRoutes } from './http/routes/app-updates.ts';
import { registerTelemetryRoutes } from './http/routes/telemetry.ts';
import { createTelemetryBuffer } from './telemetry/buffer.ts';
import { sanitizeBackendObservation } from './telemetry/sanitize.ts';

export interface DaemonOptions {
  /** Isolated browser driver factory for local integration tests. */
  browserLaunch?: (profile?: string) => Promise<BrowserDriver>;
  directory: string;
  port: number;
  dev?: boolean;
  /** Override UI serving independently of development-only runtimes; false serves APIs only. */
  ui?: 'dev' | 'built' | false;
  seedSkills?: boolean;
  /** Started by the installed background service. */
  service?: boolean;
  /** Reads the OS background service; tests replace it so no service manager is called. */
  backgroundService?: () => Promise<BackgroundServiceStatus>;
  /** Installs the OS service; tests replace it so no build or service manager is called. */
  backgroundServiceInstall?: () => Promise<BackgroundServiceStatus>;
  lockChecks?: LockChecks;
  /** Public PostHog configuration; omitted in tests and unconfigured installations. */
  analytics?: AnalyticsConfig | null;
  /** CLI configures public release checks; direct construction stays offline by default. */
  updates?: AppUpdateOptions;
  /** Public runtime release checks; direct construction remains offline. */
  runtimeUpdateChecks?: boolean;
  /** Explicit opt-in to local CLI account metadata probes for direct construction. */
  runtimeAuthenticationChecks?: boolean;
}

export const createDaemon = async (options: DaemonOptions) => {
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
};

const startDaemon = async (options: DaemonOptions, releaseLock: () => Promise<void>) => {
  const url = `http://127.0.0.1:${options.port}`;
  const diagnostics = createTelemetryBuffer(sanitizeBackendObservation, !!options.analytics);
  const service = new CrewService(
    options.directory,
    url,
    fileURLToPath(new URL('../../mcp/src/cli.ts', import.meta.url)),
    options.dev ?? false,
    options.browserLaunch,
    diagnostics,
  );
  service.runtimeMaintenance.enabled = options.runtimeUpdateChecks ?? false;
  service.runtimeMaintenance.authenticationEnabled = options.runtimeAuthenticationChecks ?? false;
  const app = Fastify({ bodyLimit: 1024 * 1024, forceCloseConnections: true });
  const http = app.server;
  const sessions = new Set<string>();
  const chatStreams = new Set<ServerResponse>();
  http.once('listening', () => {
    // Account probes can take seconds and are not required to render the workspace.
    // Every launch still joins the same authentication request through guard(); close()
    // aborts and drains these probes with the other maintenance work.
    void service.runtimeMaintenance.initializeAuthentication().catch(() => {});
    service.startScheduler();
  });
  app.addHook('preClose', async () => {
    // Node listen() does not set Fastify's listening flag, so its forced cleanup is skipped.
    // Stop accepting first, then close HTTP connections; Vite closes upgraded HMR sockets.
    http.close();
    http.closeAllConnections();
    for (const stream of chatStreams) stream.destroy();
    diagnostics.clear();
    await service.close();
  });
  app.setErrorHandler((error, _req, res) => {
    if (res.raw.headersSent) return;
    const statusCode =
      error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined;
    const status =
      typeof statusCode === 'number' &&
      Number.isInteger(statusCode) &&
      statusCode >= 400 &&
      statusCode <= 599
        ? statusCode
        : 400;
    recordOperationalLog(diagnostics, {
      code: 'http_request_failed',
      area: 'http',
      http_status: status,
      failure_category: failureCategory(error),
    });
    return res
      .status(status)
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
    app.register(async (routes) => registerExternalMcpRoutes(routes, service));
    app.get('/api/health', () => ({
      app: 'pitchcrew',
      version: '0.1.0',
      service: options.service ?? false,
    }));
    registerSnapshot(app, service);
    registerAnalyticsRoutes(app, options.analytics);
    app.register(async (routes) => registerTelemetryRoutes(routes, diagnostics));
    app.register(async (routes) => registerAppUpdateRoutes(routes, options.updates));
    registerChatStream(app, service, chatStreams);
    for (const registerRoutes of [
      registerAgentRoutes,
      registerQualityRoutes,
      registerBoardRoutes,
      registerOnboardingRoutes,
      registerPacketRulesRoutes,
      registerTrackingRoutes,
      registerLearningRoutes,
      registerProfileSourcesRoutes,
      registerJobSourcesRoutes,
      registerCrewRoutes,
      registerRuntimeMaintenanceRoutes,
      registerSkillsRoutes,
      registerRoutinesRoutes,
      registerConnectorsRoutes,
      registerApprovalsRoutes,
      registerBrowserRoutes,
    ])
      app.register(async (routes) => registerRoutes(routes, service));
    app.register(async (routes) => registerBackgroundServiceRoutes(routes, options));
    const ui = options.ui ?? (options.dev ? 'dev' : 'built');
    if (ui === false)
      app.setNotFoundHandler((_req, res) => res.status(404).send({ error: 'Route not found.' }));
    else await registerUi(app, ui === 'dev');
    // Callers retain the Node server contract; every plugin is ready before listen().
    await app.ready();
    recordOperationalLog(diagnostics, { code: 'daemon_ready', area: 'daemon' });
    const close = async () => {
      try {
        await app.close();
      } finally {
        await releaseLock();
      }
    };
    return { app, http, service, url, close };
  } catch (error) {
    recordOperationalLog(diagnostics, { code: 'daemon_start_failed', area: 'daemon' });
    await app.close();
    throw error;
  }
};
