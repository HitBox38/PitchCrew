import type { Snapshot } from '@pitchcrew/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);
describe('connector account settings', () => {
  it('requires a local user session for account changes and never gives agents a connection action', async () => {
    const { daemon, request } = await setup(14433);
    const connect = vi.spyOn(daemon.service.connectors, 'connectGithub').mockResolvedValue([]);
    const disconnect = vi.spyOn(daemon.service.connectors, 'disconnect').mockResolvedValue([]);
    for (const path of [
      '/connectors/github/connect',
      '/connectors/google/connect',
      '/connectors/github/disconnect',
    ]) {
      expect(
        (
          await fetch(`${daemon.url}/api${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          })
        ).status,
      ).toBe(403);
      expect(
        (await request(path, 'POST', {}, { origin: 'https://evil.example' })).response.status,
      ).toBe(403);
    }
    expect(connect).not.toHaveBeenCalled();
    expect(
      (await request('/connectors/github/connect', 'POST', { token: 'fixture-token' })).response
        .status,
    ).toBe(200);
    expect(connect).toHaveBeenCalledWith({ token: 'fixture-token' });
    expect((await request('/connectors/github/disconnect', 'POST', {})).response.status).toBe(200);
    expect(disconnect).toHaveBeenCalledWith('github');
    expect((await request('/connectors/arbitrary/disconnect', 'POST', {})).response.status).toBe(
      400,
    );
    const snapshot = (await request<Snapshot>('/snapshot')).result;
    expect(snapshot.connectors).toHaveLength(2);
    expect(JSON.stringify(snapshot)).not.toContain('fixture-token');
    expect(snapshot.roles.every((r) => !r.capabilities?.github && !r.capabilities?.gmail)).toBe(
      true,
    );
  });
});
