import { afterEach, expect, it, vi } from 'vitest';
import { createAgentClient } from '../src/tools/client.ts';

afterEach(() => vi.restoreAllMocks());
it('returns attachment images as MCP image content without duplicating base64 in text or structured content', async () => {
  const image = { data: 'fixture-base64-image', mimeType: 'image/png' };
  const attachment = { id: 'fixture', name: 'screenshot.png' };
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ image, attachment })),
  );
  const result = await createAgentClient('http://127.0.0.1:4417', 'fixture-token')(
    'chat_attachment',
    { messageId: 'message', attachmentId: 'fixture' },
  );
  expect(result.content).toEqual([
    { type: 'text', text: JSON.stringify({ attachment }) },
    { type: 'image', ...image },
  ]);
  expect(result.structuredContent).toEqual({ attachment });
});
