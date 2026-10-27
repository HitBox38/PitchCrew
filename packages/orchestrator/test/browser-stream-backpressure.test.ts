import { EventEmitter } from 'node:events';
import type { BrowserFrame } from '@pitchcrew/core';
import type { FastifyReply } from 'fastify';
import { expect, it, vi } from 'vitest';
import { latestFrames } from '../../mcp/src/computer/frame-queue.ts';
import { streamBrowserFrames } from '../src/http/browser-stream.ts';

it('retains only the newest image while the HTTP writer waits for drain and releases its listener on close', async () => {
  const lines: string[] = [];
  const raw = Object.assign(new EventEmitter(), {
    headersSent: false,
    writableNeedDrain: true,
    destroyed: false,
    writeHead: vi.fn(() => {
      raw.headersSent = true;
    }),
    write: vi.fn((line: string) => {
      lines.push(line);
      return !raw.writableNeedDrain;
    }),
    end: vi.fn(),
  });
  const response = { raw, hijack: vi.fn() } as unknown as FastifyReply;
  const authorize = vi.fn();
  let queue!: ReturnType<typeof latestFrames>;
  let stopped = false;
  const source = async function* (signal: AbortSignal) {
    queue = latestFrames(signal);
    try {
      while (!signal.aborted) {
        const next = await queue.next();
        if (!next || 'error' in next) return;
        yield next;
      }
    } finally {
      queue.close();
      stopped = true;
    }
  };
  const running = streamBrowserFrames(response, source, authorize);
  const frame: BrowserFrame = {
    width: 1280,
    height: 800,
    url: 'https://example.com',
    title: 'First',
    screenshot: 'fixture',
  };
  queue.push(frame);
  await vi.waitFor(() => expect(raw.write).toHaveBeenCalledOnce());
  for (let i = 0; i < 1000; i++) queue.push({ ...frame, title: `${i}` });
  expect(raw.write).toHaveBeenCalledOnce();
  raw.writableNeedDrain = false;
  raw.emit('drain');
  await vi.waitFor(() => expect(raw.write).toHaveBeenCalledTimes(2));
  expect(JSON.parse(lines[1]).title).toBe('999');
  raw.emit('close');
  await running;
  expect(stopped).toBe(true);
  expect(raw.listenerCount('drain')).toBe(0);
  expect(raw.listenerCount('close')).toBe(0);
  expect(raw.end).toHaveBeenCalledOnce();
});
