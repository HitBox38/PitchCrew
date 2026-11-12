import { diagnosticRequestHeaders } from './Analytics/request-context.ts';

let renewal: Promise<void> | undefined;

/** Loading any same-origin page issues a fresh session cookie, as opening the app does. */
const renewSession = () =>
  (renewal ??= fetch('/', { cache: 'no-store', credentials: 'same-origin' })
    .then((response) => {
      void response.body?.cancel().catch(() => {});
    })
    .finally(() => {
      renewal = undefined;
    }));

/**
 * Fetches a session-protected `/api` route. The daemon keeps sessions in memory, so a restart (an
 * update, or the background service) forgets them; its 403 then carries `x-pitchcrew-session`, and
 * the request is retried once with a renewed session. The daemon rejects these requests before
 * reading the body, so the retry cannot repeat an action.
 */
export const sessionFetch = async (
  path: string,
  init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
) => {
  const send = () =>
    fetch(path, {
      ...init,
      headers: { 'x-pitchcrew-client': 'ui', ...diagnosticRequestHeaders(), ...init.headers },
    });
  const response = await send();
  if (response.status !== 403 || response.headers.get('x-pitchcrew-session') !== 'required')
    return response;
  void response.body?.cancel().catch(() => {});
  await renewSession();
  return send();
};
