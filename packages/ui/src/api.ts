import { analytics } from './Analytics/client.ts';
import { actionEvent } from './Analytics/helpers.ts';
import { apiErrorAction, reportErrorDiagnostic } from './Analytics/error-tracking.ts';
import type { ErrorCategory } from './Analytics/error-sanitizer.ts';
import { beginApiMetric } from './Analytics/metrics/runtime.ts';

export interface ConditionalRequest {
  etag: string | null;
  updateEtag: (etag: string | null) => void;
}

export const api = (async <T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
  conditional?: ConditionalRequest,
): Promise<T | undefined> => {
  const tracked = actionEvent(path, method, body);
  const finishMetric = beginApiMetric(path, method, body);
  let result: 'success' | 'http_error' | 'network_error' | 'invalid_response' | 'aborted' =
    'network_error';
  let category: ErrorCategory | undefined = 'request_network';
  let httpStatus: number | undefined;
  try {
    const response = await fetch(`/api${path}`, {
      method,
      signal,
      ...(conditional ? ({ cache: 'no-store' } as const) : {}),
      headers: {
        'x-pitchcrew-client': 'ui',
        ...(conditional?.etag ? { 'if-none-match': conditional.etag } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    httpStatus = response.status;
    if (response.status === 304 && conditional) {
      conditional.updateEtag(response.headers.get('etag'));
      result = 'success';
      return undefined;
    }
    result = response.ok ? 'invalid_response' : 'http_error';
    category =
      response.status >= 500 ? 'request_server' : response.ok ? 'request_response' : undefined;
    const data = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(data.error ?? 'Request failed.');
    if (tracked) analytics.capture(tracked.event, tracked.properties);
    result = 'success';
    conditional?.updateEtag(response.headers.get('etag'));
    return data;
  } catch (error) {
    const aborted = signal?.aborted || (error instanceof Error && error.name === 'AbortError');
    if (aborted) result = 'aborted';
    const action = apiErrorAction(tracked?.event);
    if (action && category && !aborted)
      reportErrorDiagnostic('api_action', error, category, action);
    throw error;
  } finally {
    finishMetric(result, httpStatus);
  }
}) as {
  <T>(path: string, method?: string, body?: unknown, signal?: AbortSignal): Promise<T>;
  <T>(
    path: string,
    method: string,
    body: unknown,
    signal: AbortSignal | undefined,
    conditional: ConditionalRequest,
  ): Promise<T | undefined>;
};
