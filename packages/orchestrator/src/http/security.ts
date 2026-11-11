import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

/** Routes that authenticate themselves (or need no session) instead of using the UI session. */
const openRoutes = new Set(['/api/health', '/api/agent', '/api/external-mcp']);

export const registerSessionSecurity = (
  app: FastifyInstance,
  options: { port: number; dev?: boolean; analyticsHost?: string },
  url: string,
  sessions: Set<string>,
) => {
  app.addHook('onRequest', async (req, res) => {
    if (req.headers.host !== `127.0.0.1:${options.port}`) {
      return res.status(403).send({ error: 'Use the loopback address printed by Pitchcrew.' });
    }
    if (
      (req.headers.origin && req.headers.origin !== url) ||
      req.headers['sec-fetch-site'] === 'cross-site'
    ) {
      return res.status(403).send({ error: 'Cross-origin access is not allowed.' });
    }
    // Vite middleware and SSE write directly to the Node response.
    if (!options.dev)
      res.raw.setHeader(
        'Content-Security-Policy',
        `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'${options.analyticsHost ? ` ${options.analyticsHost}` : ''}; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
      );
    res.raw.setHeader('X-Content-Type-Options', 'nosniff');
    res.raw.setHeader('Referrer-Policy', 'no-referrer');
    const path = req.url.split('?')[0];
    // The router percent-decodes the path before matching, so the matched route decides which
    // checks apply. The raw path still covers requests that matched no route or the static wildcard.
    const route = req.routeOptions.url ?? path;
    if (openRoutes.has(route) || openRoutes.has(path)) return;
    const cookie = req.cookies.pitchcrew_session;
    if (route.startsWith('/api/') || path.startsWith('/api/')) {
      if (!cookie || !sessions.has(cookie) || req.headers['x-pitchcrew-client'] !== 'ui') {
        // Sessions live in memory and end with the daemon; this header lets an open window renew.
        return res
          .status(403)
          .header('x-pitchcrew-session', 'required')
          .send({ error: 'Open Pitchcrew in the browser to start a local session.' });
      }
    } else if (!cookie || !sessions.has(cookie)) {
      const token = randomUUID();
      sessions.add(token);
      res.raw.setHeader(
        'Set-Cookie',
        app.serializeCookie('pitchcrew_session', token, {
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
    }
  });
};
