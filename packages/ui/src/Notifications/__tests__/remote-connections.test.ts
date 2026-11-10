import type { RemoteMcpRequest } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { groupNotifications, notificationShouldAlert } from '../helpers.ts';
import { remoteConnectionNotifications } from '../remote-connections.ts';

it('keeps pending remote access in Needs you only until expiry without granting from the notice', () => {
  const request: RemoteMcpRequest = {
    id: 'remote-request',
    name: 'Self-declared app',
    code: 'ABCD-1234',
    redirectHost: 'example.test',
    scopes: ['pitchcrew:read', 'pitchcrew:write'],
    createdAt: '2026-11-10T12:00:00.000Z',
    expiresAt: '2026-11-10T12:10:00.000Z',
  };
  const items = remoteConnectionNotifications([request], Date.parse(request.createdAt));
  expect(items).toEqual([
    {
      id: 'remote-mcp:remote-request',
      kind: 'attention',
      context: 'remote_connection',
      title: 'Self-declared app wants to connect',
      body: 'App-provided name. Review only a connection you started and match its code in Settings.',
      target: '/settings',
      createdAt: request.createdAt,
    },
  ]);
  expect(notificationShouldAlert(items[0]!)).toBe(true);
  expect(groupNotifications(items)[0]?.title).toBe('Needs you');
  expect(remoteConnectionNotifications([request], Date.parse(request.expiresAt))).toEqual([]);
  expect(remoteConnectionNotifications([], Date.parse(request.createdAt))).toEqual([]);
});
