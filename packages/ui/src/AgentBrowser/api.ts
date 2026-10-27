import { api } from '@/api.ts';
import type { BrowserFrame, BrowserInput, BrowserSessionInfo } from '@pitchcrew/core';
export const streamBrowser = async (
  roleId: string,
  threadId: string,
  signal: AbortSignal,
  receive: (frame: BrowserFrame) => void,
) => {
  const response = await fetch(`/api${browserPath(roleId, threadId, 'stream')}`, {
    signal,
    headers: { 'x-pitchcrew-client': 'ui' },
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? 'Could not connect to the browser.');
  }
  if (!response.body) throw new Error('Browser streaming is unavailable.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        if (newline > 2_000_000) throw new Error('Browser frame exceeded the size limit.');
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const frame = JSON.parse(line) as BrowserFrame & { error?: string; heartbeat?: boolean };
        if (frame.heartbeat) continue;
        if (frame.error) throw new Error(frame.error);
        receive(frame);
      }
      if (buffer.length > 2_000_000) throw new Error('Browser frame exceeded the size limit.');
    }
    if (!signal.aborted) throw new Error('Browser view disconnected. Reconnecting…');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
};

export const browserPath = (roleId: string, threadId: string, action: string) =>
  `/browser/${encodeURIComponent(roleId)}/${action}?threadId=${encodeURIComponent(threadId)}`;
export const browserSessions = (threadId: string, signal?: AbortSignal) =>
  api<BrowserSessionInfo[]>(
    `/browser?threadId=${encodeURIComponent(threadId)}`,
    'GET',
    undefined,
    signal,
  );
export const browserCommand = <T>(
  roleId: string,
  threadId: string,
  action: string,
  input?: unknown,
  signal?: AbortSignal,
) => api<T>(browserPath(roleId, threadId, action), 'POST', input ?? {}, signal);
export const browserInput = (
  roleId: string,
  threadId: string,
  leaseId: string,
  input: BrowserInput,
) => browserCommand(roleId, threadId, 'input', { leaseId, input });
