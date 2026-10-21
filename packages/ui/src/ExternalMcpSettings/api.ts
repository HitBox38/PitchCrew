import { api } from '@/api.ts';
import type { ExternalMcpInfo } from '@pitchcrew/core';

export const loadExternalMcp = (signal: AbortSignal) =>
  api<ExternalMcpInfo>('/external-mcp/access', 'GET', undefined, signal);
export const configureExternalMcp = (enabled: boolean, write: boolean) =>
  api<ExternalMcpInfo>('/external-mcp/access', 'PUT', { enabled, write });
