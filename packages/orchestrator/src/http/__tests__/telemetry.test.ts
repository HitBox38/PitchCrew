import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { expect, it } from 'vitest';
import { createTelemetryBuffer } from '../../telemetry/buffer.ts';
import { registerTelemetryRoutes } from '../routes/telemetry.ts';
import { registerSessionSecurity } from '../security.ts';

it('allows sanitized observations only through the user loopback session and skips initial backlog', async () => {
  const buffer = createTelemetryBuffer(
    (event) => (event === 'fixture' ? { count: 1 } : null),
    true,
  );
  buffer.record('fixture', { content: 'Private', path: '/private' });
  const app = Fastify();
  await app.register(cookie);
  registerSessionSecurity(
    app,
    { port: 4417 },
    'http://127.0.0.1:4417',
    new Set(['fixture-session']),
  );
  registerTelemetryRoutes(app, buffer);
  const headers = {
    host: '127.0.0.1:4417',
    cookie: 'pitchcrew_session=fixture-session',
    'x-pitchcrew-client': 'ui',
  };
  try {
    expect(
      (await app.inject({ url: '/api/telemetry/observations', headers: { host: headers.host } }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          url: '/api/telemetry/observations',
          headers: { ...headers, host: 'localhost:4417' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          url: '/api/telemetry/observations',
          headers: { ...headers, origin: 'https://private.example' },
        })
      ).statusCode,
    ).toBe(403);
    const initial = await app.inject({ url: '/api/telemetry/observations', headers });
    expect(initial.json()).toMatchObject({ enabled: true, cursor: 1, observations: [] });
    const next = await app.inject({ url: '/api/telemetry/observations?after=0', headers });
    expect(next.json().observations).toEqual([
      { sequence: 1, event: 'fixture', properties: { count: 1 } },
    ]);
  } finally {
    await app.close();
  }
});
