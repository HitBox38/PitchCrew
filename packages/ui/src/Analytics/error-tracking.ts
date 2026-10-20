import { analytics } from './client.ts';
import { useDevicePreferences } from '../lib/device-preferences.ts';
import {
  sanitizeException,
  type ErrorAction,
  type ErrorCategory,
  type ErrorSource,
} from './error-sanitizer.ts';
import type { AnalyticsEvent } from './types.ts';

const classifyError = (error: unknown): ErrorCategory => {
  if (error instanceof TypeError) return 'type_error';
  if (error instanceof ReferenceError) return 'reference_error';
  if (error instanceof RangeError) return 'range_error';
  if (error instanceof SyntaxError) return 'syntax_error';
  if (error instanceof URIError) return 'uri_error';
  if (error instanceof EvalError) return 'evaluation_error';
  return error instanceof Error ? 'generic_error' : 'non_error';
};

/** At most 20 reports/minute, one per category/source/action/minute; no deferred queue. */
export const createErrorReporter = (
  capture: (event: string, properties: Record<string, unknown>) => void,
  enabled: () => boolean,
  now: () => number = Date.now,
) => {
  const fingerprints = new Map<string, number>();
  const seen = new WeakSet<object>();
  let windowStart = 0;
  let count = 0;
  return (source: ErrorSource, error: unknown, category?: ErrorCategory, action?: ErrorAction) => {
    try {
      if (!enabled()) return;
      const properties = sanitizeException({
        error_source: source,
        error_category: category ?? classifyError(error),
        error_action: action,
      });
      if (!properties) return;
      const at = now();
      if (at - windowStart >= 60_000 || at < windowStart) {
        windowStart = at;
        count = 0;
        fingerprints.clear();
      }
      const fingerprint = properties.$exception_fingerprint as string;
      const object =
        error !== null && (typeof error === 'object' || typeof error === 'function')
          ? error
          : undefined;
      if (count >= 20 || fingerprints.has(fingerprint) || (object && seen.has(object))) return;
      count += 1;
      fingerprints.set(fingerprint, at);
      if (object) seen.add(object);
      capture('$exception', properties);
    } catch {
      /* Proxy/getter, consent and transport failures must never replace application errors. */
    }
  };
};

/** Normal browser reporting is left intact: listeners never preventDefault or rethrow. */
export const installErrorTracking = (target: Window, report = reportErrorDiagnostic) => {
  const onError = (event: ErrorEvent) => report('window_error', event.error);
  const onRejection = (event: PromiseRejectionEvent) => report('unhandled_rejection', event.reason);
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
};

export const apiErrorAction = (event: AnalyticsEvent | undefined): ErrorAction | undefined => {
  if (!event) return undefined;
  if (event.startsWith('chat_') || event.startsWith('conversation_')) return 'chat';
  if (event.startsWith('user_question_')) return 'question';
  if (event.startsWith('pipeline_')) return 'pipeline';
  for (const action of [
    'workflow',
    'profile',
    'agent',
    'skill',
    'routine',
    'job',
    'application',
    'approval',
    'browser',
    'onboarding',
  ] as const)
    if (
      event.startsWith(`${action}_`) ||
      (action === 'application' && event.startsWith('applications_')) ||
      (action === 'approval' && event.startsWith('packet_'))
    )
      return action;
};

export const reportErrorDiagnostic = createErrorReporter(
  (event, properties) => analytics.captureDiagnostic(event, properties),
  () => {
    const preferences = useDevicePreferences.getState();
    return preferences.analytics && preferences.diagnostics && analytics.diagnosticsEnabled();
  },
);
