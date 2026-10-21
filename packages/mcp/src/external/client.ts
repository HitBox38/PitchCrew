import type { ExternalAccess } from './access.ts';
import type { ExternalCall } from './server.ts';

/** Never accepts remote targets, redirects, or UI cookies. Credentials stay in this process. */
export const createExternalClient = (url: string, access: ExternalAccess): ExternalCall => {
  const target = new URL(url);
  if (
    target.protocol !== 'http:' ||
    target.hostname !== '127.0.0.1' ||
    target.username ||
    target.password ||
    target.pathname !== '/' ||
    target.search ||
    target.hash
  )
    throw new Error('External MCP requires a plain HTTP loopback daemon URL.');
  return async (action, input) => {
    try {
      const response = await fetch(new URL('/api/external-mcp', target), {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${access.token}` },
        body: JSON.stringify({ action, input }),
      });
      const result = (await response.json()) as Record<string, unknown>;
      if (!response.ok)
        throw new Error(String(result.error ?? `Pitchcrew returned HTTP ${response.status}.`));
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `${error instanceof Error ? error.message : 'Pitchcrew request failed.'} Ensure Pitchcrew is running and external MCP access is enabled. Do not retry writes without checking their result in the app.`,
          },
        ],
      };
    }
  };
};
