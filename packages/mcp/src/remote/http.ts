import express from 'express';
import type { RequestHandler } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  createOAuthMetadata,
  mcpAuthRouter,
  getOAuthProtectedResourceMetadataUrl,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { createExternalMcpServer } from '../external/server.ts';
import { externalTools, type ExternalAction } from '../external/tools.ts';
import type { RemoteAuthorization } from './authorization.ts';
import { registerConnectionPage } from './waiting-page.ts';
import { oauthScope } from './authorization-state.ts';

export const createRemoteHttpHandler = (options: {
  resource: URL;
  localHost: string;
  authorization: RemoteAuthorization;
  instance: string;
  call: (
    action: ExternalAction,
    input: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
}) => {
  const { resource, authorization } = options;
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (![resource.host, options.localHost].includes(req.headers.host ?? '')) {
      res.status(403).json({ error: 'invalid_host' });
      return;
    }
    // Remote bearer clients use no browser cookies or credentialed CORS.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, MCP-Protocol-Version, Accept',
    );
    res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate, MCP-Protocol-Version');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.status(204).end();
      return;
    }
    req.setTimeout(45000, () => res.destroy());
    next();
  });
  app.get('/connection-check', (_req, res) => res.json({ instance: options.instance }));
  const rateLimit = { keyGenerator: () => 'remote-connection' };
  const authOptions = {
    provider: authorization,
    issuerUrl: new URL(resource.origin),
    resourceServerUrl: resource,
    scopesSupported: [oauthScope],
    resourceName: 'Pitchcrew',
    authorizationOptions: { rateLimit },
    clientRegistrationOptions: { rateLimit },
    tokenOptions: { rateLimit },
    revocationOptions: { rateLimit },
  };
  app.get('/.well-known/oauth-authorization-server', (_req, res) =>
    res.json({
      ...createOAuthMetadata(authOptions),
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
    }),
  );
  app.use(mcpAuthRouter(authOptions));
  registerConnectionPage(app, authorization);
  // Authenticate before any MCP request body is parsed.
  app.use(
    '/mcp',
    requireBearerAuth({
      verifier: authorization,
      requiredScopes: [oauthScope],
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resource),
    }),
  );
  let activeRequests = 0;
  app.post('/mcp', (_req, res, next) => {
    if (activeRequests >= 16) {
      res.status(429).json({ error: 'too_many_requests' });
      return;
    }
    activeRequests++;
    res.once('close', () => {
      activeRequests--;
    });
    next();
  });
  app.post('/mcp', express.json({ limit: '128kb' }), (async (req, res) => {
    const auth = req.auth!;
    const server = createExternalMcpServer(async (action, input) => {
      try {
        const current = await authorization.verifyAccessToken(auth.token);
        const tool = externalTools[action];
        if ('write' in tool && tool.write && current.extra?.write !== true)
          throw new Error(
            'This app has read-only access. Reconnect and ask the user to allow changes in Pitchcrew.',
          );
        const result = await options.call(action, input);
        await authorization.touch(String(current.extra?.grantId ?? '')).catch(() => {});
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text:
                error instanceof Error
                  ? error.message
                  : 'Pitchcrew could not complete the request.',
            },
          ],
        };
      }
    }, auth.extra?.write === true);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const close = () => {
      void server.close().catch(() => {});
    };
    res.once('close', close);
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) res.status(500).json({ error: 'server_error' });
      else res.end();
      close();
    }
  }) satisfies RequestHandler);
  app.all('/mcp', (_req, res) =>
    res.status(405).set('Allow', 'POST').json({
      error: 'Use JSON MCP POST requests. Streaming is not available on temporary connections.',
    }),
  );
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use(((error, _req, res, _next) => {
    res.status(error?.type === 'entity.too.large' ? 413 : 400).json({ error: 'invalid_request' });
  }) satisfies express.ErrorRequestHandler);
  return app;
};
