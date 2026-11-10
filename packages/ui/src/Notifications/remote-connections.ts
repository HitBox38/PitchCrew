import type { RemoteMcpRequest } from '@pitchcrew/core';
import type { CrewNotification } from './types.ts';

export const remoteConnectionNotifications = (
  requests: RemoteMcpRequest[],
  now = Date.now(),
): CrewNotification[] =>
  requests
    .filter((request) => Date.parse(request.expiresAt) > now)
    .map((request) => ({
      id: `remote-mcp:${request.id}`,
      kind: 'attention',
      context: 'remote_connection',
      title: `${request.name} wants to connect`,
      body: 'App-provided name. Review only a connection you started and match its code in Settings.',
      target: '/settings',
      createdAt: request.createdAt,
    }));
