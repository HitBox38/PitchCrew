import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { RuntimeAdapter } from '../../../core/src/index.ts';
import { setTimeout as delay } from 'node:timers/promises';

/** Deterministic provider boundary; calls the real scoped MCP stdio server. */
export const browserE2EChat: RuntimeAdapter['chat'] = async (context) => {
  const client = new Client({ name: 'pitchcrew-browser-e2e', version: '1.0.0' });
  const transport = new StdioClientTransport({ ...context.mcp, stderr: 'pipe' });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const deadline = Date.now() + 5000;
    for (;;) {
      context.signal.throwIfAborted();
      const result = await client.callTool({ name: `pitchcrew_${name}`, arguments: args });
      if (!result.isError) return result.structuredContent as Record<string, unknown>;
      const detail = (result.content as { type: string; text?: string }[])
        .map((item) => item.text ?? '')
        .join('\n');
      // Resizing owns the session lock, including when a new run first binds it.
      // Retry only inspection and pre-action requests, never action execution.
      const retryable =
        (name === 'computer_inspect' && detail.trim() === 'A browser action is still finishing.') ||
        (name === 'computer_request' && detail.trim() === 'A browser action is in progress.');
      if (!retryable || Date.now() >= deadline) throw new Error(detail);
      await delay(100, undefined, { signal: context.signal });
    }
  };
  try {
    await client.connect(transport);
    const request = context.request ?? context.messages.at(-1)?.content ?? '';
    if (
      ![
        'E2E: inspect the application',
        'E2E: fill the application',
        'E2E: click Continue',
      ].includes(request)
    )
      throw new Error('Unexpected browser E2E provider request.');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { page } = await call('computer_inspect');
        if (request === 'E2E: inspect the application')
          return { reply: `I inspected the actual browser page: ${JSON.stringify(page)}` };
        const action =
          request === 'E2E: click Continue'
            ? { kind: 'click', selector: '#continue' }
            : { kind: 'fill', selector: '#name', value: 'Agent E2E' };
        let requested: Record<string, unknown>;
        try {
          requested = await call('computer_request', {
            input: action,
            reason: 'E2E exact action on the fictional application',
          });
        } catch (error) {
          // A failed evidence freeze saved no approval. Refresh before retrying;
          // keep execution outside this catch so a performed action cannot replay.
          if (/native browser viewport changed/i.test(String(error))) continue;
          throw error;
        }
        const id = (requested.approval as { id: string }).id;
        let outcome: Record<string, unknown>;
        do {
          context.signal.throwIfAborted();
          outcome = await call('computer_execute', { approvalId: id });
        } while (outcome.status === 'pending');
        await call('computer_inspect');
        return { reply: 'I completed the approved E2E browser action.' };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        if (/native browser resized|page (?:has )?changed/i.test(detail)) continue;
        if (/Browser action is rejected/.test(detail))
          return { reply: 'I did not perform the rejected E2E action.' };
        throw error;
      }
    }
    throw new Error('The browser evidence kept changing across three fresh requests.');
  } finally {
    await client.close();
  }
};
