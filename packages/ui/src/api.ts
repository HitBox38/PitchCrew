import { analytics } from './Analytics/client.ts';
import { actionEvent } from './Analytics/helpers.ts';
import { apiErrorAction, reportErrorDiagnostic } from './Analytics/error-tracking.ts';
import type { ErrorCategory } from './Analytics/error-sanitizer.ts';

export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const tracked = actionEvent(path, method, body);
  const init = {
    method,
    signal,
    headers: {
      'x-pitchcrew-client': 'ui',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  let category: ErrorCategory | undefined = 'request_network';
  try {
    const response = await fetch(`/api${path}`, init);
    category =
      response.status >= 500 ? 'request_server' : response.ok ? 'request_response' : undefined;
    const data = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(data.error ?? 'Request failed.');
    if (tracked) analytics.capture(tracked.event, tracked.properties);
    return data;
  } catch (error) {
    const action = apiErrorAction(tracked?.event);
    if (action && category && !signal?.aborted)
      reportErrorDiagnostic('api_action', error, category, action);
    throw error;
  }
}
