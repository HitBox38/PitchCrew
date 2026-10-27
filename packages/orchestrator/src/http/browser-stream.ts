import type { BrowserFrame } from '@pitchcrew/core';
import type { FastifyReply } from 'fastify';

const frameLimit = 2_000_000;

export const streamBrowserFrames = async (
  response: FastifyReply,
  source: (signal: AbortSignal) => AsyncIterable<BrowserFrame>,
  authorize: () => void,
) => {
  const controller = new AbortController();
  const { signal } = controller;
  const stop = () => controller.abort();
  response.raw.on('close', stop);
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const drain = () =>
    new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timeout);
        response.raw.off('drain', done);
        signal.removeEventListener('abort', done);
        resolve();
      };
      const timeout = setTimeout(stop, 5000);
      response.raw.once('drain', done);
      signal.addEventListener('abort', done, { once: true });
      if (signal.aborted || response.raw.destroyed) done();
    });
  try {
    for await (const frame of source(signal)) {
      authorize();
      if (signal.aborted) break;
      if (!response.raw.headersSent) {
        response.raw.writeHead(200, {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        response.hijack();
        // Static pages still need revocation checks and a liveness signal.
        heartbeat = setInterval(() => {
          try {
            authorize();
            if (!response.raw.writableNeedDrain) response.raw.write('{"heartbeat":true}\n');
          } catch {
            stop();
          }
        }, 1000);
      }
      const line = `${JSON.stringify(frame)}\n`;
      if (Buffer.byteLength(line) > frameLimit) throw new Error('Browser frame is too large.');
      if (!response.raw.write(line)) await drain();
    }
  } catch (error) {
    if (!response.raw.headersSent) throw error;
    if (!signal.aborted && !response.raw.writableNeedDrain)
      response.raw.write('{"error":"Browser view disconnected. Reconnecting…"}\n');
  } finally {
    stop();
    clearInterval(heartbeat);
    response.raw.off('close', stop);
    if (response.raw.headersSent) response.raw.end();
  }
};
