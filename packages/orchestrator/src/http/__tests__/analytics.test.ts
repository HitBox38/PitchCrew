import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { analyticsConfig, registerAnalyticsRoutes } from '../analytics.ts';
import { registerSessionSecurity } from '../security.ts';

describe('PostHog installation configuration', () => {
  const env = {
    PITCHCREW_POSTHOG_TOKEN: 'phc_fictional123',
    PITCHCREW_POSTHOG_HOST: 'https://eu.i.posthog.com',
  };

  it('uses the bundled project, supports disabling and keeps development capture off by default', () => {
    expect(analyticsConfig({}, false)).toMatchObject({ host: 'https://eu.i.posthog.com' });
    expect(analyticsConfig({ PITCHCREW_POSTHOG_DISABLED: '1' }, false)).toBeNull();
    expect(analyticsConfig({ PITCHCREW_POSTHOG_TOKEN: '' }, false)).toBeNull();
    expect(analyticsConfig(env, true)).toBeNull();
    expect(analyticsConfig({ ...env, PITCHCREW_POSTHOG_DEV: '1' }, true)).toEqual({
      token: env.PITCHCREW_POSTHOG_TOKEN,
      host: env.PITCHCREW_POSTHOG_HOST,
    });
    expect(
      analyticsConfig({ PITCHCREW_POSTHOG_TOKEN: env.PITCHCREW_POSTHOG_TOKEN }, false)?.host,
    ).toBe('https://eu.i.posthog.com');
  });

  it.each([
    'http://example.invalid',
    'https://user:pass@example.invalid',
    'https://example.invalid/path',
    'https://example.invalid?query=secret',
    'https://example.invalid/#hash',
  ])('rejects unsafe host configuration %s', (host) => {
    expect(() => analyticsConfig({ ...env, PITCHCREW_POSTHOG_HOST: host }, false)).toThrow();
  });

  it('rejects personal API keys', () => {
    expect(() =>
      analyticsConfig({ PITCHCREW_POSTHOG_TOKEN: 'phx_personal_secret' }, false),
    ).toThrow('public PostHog project token');
  });

  it('protects configuration with the UI session and permits only the configured ingestion origin', async () => {
    const config = analyticsConfig(env, false)!;
    const app = Fastify();
    await app.register(cookie);
    registerSessionSecurity(
      app,
      { port: 4417, analyticsHost: config.host },
      'http://127.0.0.1:4417',
      new Set(['fixture-session']),
    );
    registerAnalyticsRoutes(app, config);
    try {
      const denied = await app.inject({
        url: '/api/analytics/config',
        headers: { host: '127.0.0.1:4417' },
      });
      expect(denied.statusCode).toBe(403);
      const response = await app.inject({
        url: '/api/analytics/config',
        headers: {
          host: '127.0.0.1:4417',
          cookie: 'pitchcrew_session=fixture-session',
          'x-pitchcrew-client': 'ui',
        },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(config);
      expect(response.headers['content-security-policy']).toContain(
        "connect-src 'self' https://eu.i.posthog.com;",
      );
      expect(response.headers['content-security-policy']).toContain("script-src 'self';");
      expect(response.headers['content-security-policy']).not.toContain('us.i.posthog.com');
    } finally {
      await app.close();
    }
  });
});
