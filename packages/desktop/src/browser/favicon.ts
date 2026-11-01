import { assertPublicUrl } from '../../../mcp/src/computer/network.ts';

/** Renderer chrome never loads a website's URL with the trusted app session. */
export const browserFavicon = async (value: string, signal: AbortSignal) => {
  let url = value;
  for (let attempt = 0; attempt < 4; attempt++) {
    await assertPublicUrl(url);
    const response = await fetch(url, { redirect: 'manual', signal });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location');
      await response.body?.cancel();
      if (!next) return;
      url = new URL(next, url).href;
      continue;
    }
    const type = response.headers.get('content-type')?.split(';')[0]?.trim();
    if (
      !response.ok ||
      !type ||
      !/^image\/(png|jpeg|webp|gif|x-icon|vnd.microsoft.icon)$/.test(type)
    ) {
      await response.body?.cancel();
      return;
    }
    if (Number(response.headers.get('content-length')) > 65536) {
      await response.body?.cancel();
      return;
    }
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (!response.body) return;
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        length += chunk.byteLength;
        if (length > 65536) return;
        chunks.push(chunk);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return `data:${type};base64,${Buffer.concat(chunks).toString('base64')}`;
  }
};
