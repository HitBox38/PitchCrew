import { sanitizeStartup } from './sanitize.ts';

export const createStartupTracker = (deps: {
  read: () => Promise<unknown>;
  allowed: () => boolean;
  enabled: () => boolean;
  capture: (event: string, properties: Record<string, number>) => void;
}) => {
  let started = false;
  let discarded = !deps.allowed();
  let pending: Record<string, number> | null = null;
  const flush = () => {
    if (discarded || !deps.allowed() || !deps.enabled() || !pending) return;
    const timing = pending;
    pending = null;
    deps.capture('app_startup_finished', timing);
  };
  return {
    flush,
    discard: () => {
      discarded = true;
      pending = null;
    },
    ready: async () => {
      if (started || discarded || !deps.allowed()) return;
      started = true;
      try {
        const timing = await deps.read();
        if (discarded || !deps.allowed() || !timing || typeof timing !== 'object') return;
        pending = sanitizeStartup(timing as Record<string, unknown>);
        flush();
      } catch {
        // A missing or failed native bridge must never affect startup.
      }
    },
  };
};
