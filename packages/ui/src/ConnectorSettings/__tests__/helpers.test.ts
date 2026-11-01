import type { ConnectorStatus, Role } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { serviceAccess } from '../helpers.ts';

const role = (id: string, capabilities: Record<string, boolean>, retired = false) =>
  ({
    id,
    name: id[0]!.toUpperCase() + id.slice(1),
    capabilities,
    retiredAt: retired ? 'x' : undefined,
  }) as unknown as Role;
const google = (patch: Partial<ConnectorStatus>) =>
  ({
    id: 'google',
    connected: true,
    pending: false,
    services: ['gmail'],
    ...patch,
  }) as ConnectorStatus;

it('lists agents per granted Google service and explains missing grants', () => {
  const roles = [
    role('tracker', { gmail: true, drive: true }),
    role('scout', { gmail: true }, true),
  ];
  const rows = serviceAccess(roles, google({ services: ['gmail', 'sheets'] }));
  expect(rows.map((row) => row.service)).toEqual(['gmail', 'drive', 'sheets', 'calendar']);
  expect(rows[0]).toMatchObject({ granted: true, agents: ['Tracker'], note: 'Tracker' });
  expect(rows[1]).toMatchObject({ granted: false, note: 'Not granted by this Google account' });
  expect(rows[2]).toMatchObject({ granted: true, note: 'No agents' });
});

it('asks to connect first when the account is not connected', () => {
  const [row] = serviceAccess([role('scout', { github: true })], {
    id: 'github',
    connected: false,
    pending: false,
    services: [],
  } as unknown as ConnectorStatus);
  expect(row).toMatchObject({ granted: false, agents: ['Scout'], note: 'Connect GitHub first' });
});
