import express from 'express';
import { randomUUID } from 'node:crypto';

export function registerSessionSecurity(
  app: express.Express,
  options: { port: number; dev?: boolean },
  url: string,
  sessions: Set<string>,
) {
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
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
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
}
