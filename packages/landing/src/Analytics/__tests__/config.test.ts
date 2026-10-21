import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it('enables valid production configuration and keeps normal development offline', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_TOKEN', 'phc_fictional123');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://eu.i.posthog.com');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_DEV', '');
  const { analyticsConfigured } = await import('../config');
  expect(analyticsConfigured()).toBe(true);
  vi.stubEnv('NODE_ENV', 'development');
  expect(analyticsConfigured()).toBe(false);
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_DEV', '1');
  expect(analyticsConfigured()).toBe(true);
});

it.each([
  ['', 'https://eu.i.posthog.com'],
  ['', '/relay'],
  ['phx_private_key', 'https://eu.i.posthog.com'],
  ['phc_fictional123', 'http://example.invalid'],
  ['phc_fictional123', 'https://example.invalid/private'],
  ['phc_fictional123', 'https://user:password@example.invalid'],
  ['phc_fictional123', '//example.invalid'],
  ['phc_fictional123', '/private-proxy'],
])('disables capture for invalid configuration', async (token, host) => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_TOKEN', token);
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', host);
  const { analyticsConfigured } = await import('../config');
  expect(analyticsConfigured()).toBe(false);
});

it('uses the fixed first-party proxy by default', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_TOKEN', 'phc_fictional123');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', undefined);
  const { analyticsConfigured, analyticsConfig } = await import('../config');
  expect(analyticsConfig.host).toBe('/relay');
  expect(analyticsConfigured()).toBe(true);
});
