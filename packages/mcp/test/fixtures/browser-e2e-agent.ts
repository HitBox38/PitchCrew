import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { RuntimeAdapter } from '../../../core/src/index.ts';

/** Deterministic provider boundary; calls the real scoped MCP stdio server. */
export const browserE2EChat: RuntimeAdapter['chat'] = async (context) => {
  const client = new Client({ name: 'pitchcrew-browser-e2e', version: '1.0.0' });
  const transport = new StdioClientTransport({ ...context.mcp, stderr: 'pipe' });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name: `pitchcrew_${name}`, arguments: args });
    if (result.isError)
      throw new Error(
        (result.content as { type: string; text?: string }[])
          .map((item) => item.text ?? '')
          .join('\n'),
      );
    return result.structuredContent as Record<string, unknown>;
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
        const { approval } = await call('computer_request', {
          input: action,
          reason: 'E2E exact action on the fictional application',
        });
        const id = (approval as { id: string }).id;
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
