import type { FastifyInstance } from 'fastify';
import { analyticsProject } from './analytics-project.ts';

export interface AnalyticsConfig {
  token: string;
  host: string;
}

/** The public ingestion token is configuration, never a personal PostHog API key. */
export function analyticsConfig(env: NodeJS.ProcessEnv, dev: boolean): AnalyticsConfig | null {
  if (env.PITCHCREW_POSTHOG_DISABLED === '1') return null;
  const token = (env.PITCHCREW_POSTHOG_TOKEN ?? analyticsProject.token).trim();
  if (!token || (dev && env.PITCHCREW_POSTHOG_DEV !== '1')) return null;
  if (!/^phc_[a-zA-Z0-9_-]{8,200}$/.test(token))
    throw new Error('PITCHCREW_POSTHOG_TOKEN must be a public PostHog project token (phc_).');
  const host = new URL(env.PITCHCREW_POSTHOG_HOST ?? analyticsProject.host);
  if (
    host.protocol !== 'https:' ||
    host.username ||
    host.password ||
    host.pathname !== '/' ||
    host.search ||
    host.hash
  )
    throw new Error(
      'PITCHCREW_POSTHOG_HOST must be an HTTPS origin without a path or credentials.',
    );
  return { token, host: host.origin };
}

export function registerAnalyticsRoutes(app: FastifyInstance, config?: AnalyticsConfig | null) {
  app.get('/api/analytics/config', () => config ?? null);
}
