import { sanitizeOperationalLog } from '@pitchcrew/core/operational-logs';
import type { AnalyticsConfig } from '../types.ts';
import { operationalLogPayload, type LogContext } from './otlp.ts';

interface Dependencies {
  consent: () => boolean;
  /** Must read the existing initialized PostHog SDK ID; never a custom/entity identifier. */
  getDistinctId: () => string | undefined;
  context: () => LogContext;
  fetch?: typeof fetch;
  now?: () => number;
}

function validatedConfig(input: AnalyticsConfig | null): AnalyticsConfig | null {
  if (!input || !/^phc_[a-zA-Z0-9_-]{8,200}$/.test(input.token)) return null;
  try {
    const host = new URL(input.host);
    if (
      host.protocol !== 'https:' ||
      host.username ||
      host.password ||
      host.pathname !== '/' ||
      host.search ||
      host.hash
    )
      return null;
    return { token: input.token, host: host.origin };
  } catch {
    return null;
  }
}

/** Immediate bounded OTLP sends: no queue, retry, persistence, console interception or unload flush. */
export function createOperationalLogTransport(dependencies: Dependencies) {
  const send = dependencies.fetch ?? globalThis.fetch;
  const now = dependencies.now ?? Date.now;
  let config: AnalyticsConfig | null = null;
  let disposed = false;
  const pending = new Set<AbortController>();
  const abort = () => {
    for (const controller of pending) controller.abort();
    pending.clear();
  };
  return {
    setEnabled(enabled: boolean, next: AnalyticsConfig | null) {
      abort();
      config = !disposed && enabled && dependencies.consent() ? validatedConfig(next) : null;
    },
    async capture(event: string, input: Record<string, unknown>): Promise<boolean> {
      if (event !== 'operational_log' || !config || !dependencies.consent() || pending.size >= 2)
        return false;
      const log = sanitizeOperationalLog(input);
      if (!log) return false;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const distinctId = dependencies.getDistinctId();
        if (!distinctId || !/^[a-zA-Z0-9_-]{1,200}$/.test(distinctId)) return false;
        const context = dependencies.context();
        if (
          !/^\d{1,5}\.\d{1,5}\.\d{1,5}(?:-[a-zA-Z0-9.-]{1,50})?$/.test(context.app_version) ||
          !['browser', 'electron'].includes(context.renderer) ||
          context.analytics_schema !== 2
        )
          return false;
        const body = JSON.stringify(operationalLogPayload(log, context, distinctId, now()));
        if (body.length > 8192 || !config || !dependencies.consent()) return false;
        pending.add(controller);
        timer = setTimeout(() => controller.abort(), 5000);
        const response = await send(`${config.host}/i/v1/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
          body,
          signal: controller.signal,
          credentials: 'omit',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
          cache: 'no-store',
        });
        // Response contents and error text are deliberately never collected.
        void response.body?.cancel().catch(() => {});
        return response.ok && !controller.signal.aborted && dependencies.consent();
      } catch {
        return false;
      } finally {
        if (timer) clearTimeout(timer);
        pending.delete(controller);
      }
    },
    dispose() {
      disposed = true;
      config = null;
      abort();
    },
  };
}
