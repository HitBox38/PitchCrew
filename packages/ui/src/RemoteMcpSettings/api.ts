import type { RemoteMcpInfo } from '@pitchcrew/core';
import { api } from '@/api.ts';

export const loadRemoteMcp = (signal: AbortSignal) =>
  api<RemoteMcpInfo>('/remote-mcp', 'GET', undefined, signal);

export const changeRemoteMcp = (path: string, method: 'POST' | 'DELETE', body?: unknown) =>
  api<RemoteMcpInfo>(`/remote-mcp${path}`, method, body, AbortSignal.timeout(30000));
