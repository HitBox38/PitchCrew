export function createAgentClient(url: string, token: string) {
  async function call(action: string, data: Record<string, unknown> = {}) {
    try {
      const response = await fetch(`${url}/api/agent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, ...data }),
      });
      const result = (await response.json()) as Record<string, unknown>;
      if (!response.ok) throw new Error(String(result.error ?? 'Tool failed.'));
      const approval = result.approval as Record<string, unknown> | undefined;
      const page = (result.page ?? approval?.page) as { screenshot?: string } | undefined;
      const { screenshot, ...description } = page ?? {};
      const image =
        action === 'chat_attachment'
          ? (result.image as { data: string; mimeType: string } | undefined)
          : undefined;
      const { image: _image, ...attachmentResult } = result;
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              page
                ? approval
                  ? { ...result, approval: { ...approval, page: description } }
                  : { ...result, page: description }
                : image
                  ? attachmentResult
                  : result,
            ),
          },
          ...(screenshot
            ? [{ type: 'image' as const, data: screenshot, mimeType: 'image/jpeg' }]
            : []),
          ...(image
            ? [{ type: 'image' as const, data: image.data, mimeType: image.mimeType }]
            : []),
        ],
        structuredContent: image ? attachmentResult : result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          { type: 'text' as const, text: error instanceof Error ? error.message : 'Tool failed.' },
        ],
      };
    }
  }
  return call;
}
export type AgentCall = ReturnType<typeof createAgentClient>;
