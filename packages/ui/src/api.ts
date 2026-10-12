import { analytics } from './Analytics/client.ts';
import { actionEvent } from './Analytics/helpers.ts';
import { apiErrorAction, reportErrorDiagnostic } from './Analytics/error-tracking.ts';
import type { ErrorCategory } from './Analytics/error-sanitizer.ts';
import { beginApiMetric } from './Analytics/metrics/runtime.ts';

export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const tracked = actionEvent(path, method, body);
  const finishMetric = beginApiMetric(path, method, body);
  let result: 'success' | 'http_error' | 'network_error' | 'invalid_response' | 'aborted' =
    'network_error';
  let category: ErrorCategory | undefined = 'request_network';
  try {
    const response = await fetch(`/api${path}`, {
      method,
      signal,
      headers: {
        'x-pitchcrew-client': 'ui',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    result = response.ok ? 'invalid_response' : 'http_error';
    category = response.status >= 500 ? 'request_server' : response.ok ? 'request_response' : undefined;
    const data = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(data.error ?? 'Request failed.');
    if (tracked) analytics.capture(tracked.event, tracked.properties);
    result = 'success';
    return data;
  } catch (error) {
    const aborted = signal?.aborted || (error instanceof Error && error.name === 'AbortError');
    if (aborted) result = 'aborted';
    const action = apiErrorAction(tracked?.event);
    if (action && category && !aborted) reportErrorDiagnostic('api_action', error, category, action);
    throw error;
  } finally {
    finishMetric(result);
  }
}
