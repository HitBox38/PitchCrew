import { analytics } from './Analytics/client.ts';
import { actionEvent } from './Analytics/helpers.ts';

export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    signal,
    headers: {
      'x-pitchcrew-client': 'ui',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? 'Request failed.');
  const tracked = actionEvent(path, method, body);
  if (tracked) analytics.capture(tracked.event, tracked.properties);
  return data;
}
