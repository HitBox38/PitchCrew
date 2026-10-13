import type { ProfileOrganization, Snapshot } from '@pitchcrew/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProfileOrganizationStore } from '../src/profile-organization.ts';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);

describe('profile explorer organization', () => {
  it('persists nested folders and note moves without changing note identities, contents or events', async () => {
    const { request, directory, daemon } = await setup(4591);
    await request('/profile', 'PUT', {
      name: 'project.md',
      content: '# Exact evidence\n\n- Built a fictional planner.',
    });
    const events = daemon.service.board.events().length;
    const before = await request<Snapshot>('/snapshot');
    expect(
      (
        await request('/profile/organization', 'POST', {
          action: 'create',
          path: 'Projects/Planning',
        })
      ).response.status,
    ).toBe(200);
    const moved = await request<ProfileOrganization>('/profile/organization', 'POST', {
      action: 'move',
      name: 'project.md',
      folder: 'Projects/Planning',
    });
    expect(moved.result).toEqual({
      version: 1,
      folders: ['Projects', 'Projects/Planning'],
      locations: { 'project.md': 'Projects/Planning' },
    });
    const after = await request<Snapshot>('/snapshot');
    expect(after.result.profile).toEqual(before.result.profile);
    expect(after.result.profileOrganization).toEqual(moved.result);
    expect(daemon.service.board.events()).toHaveLength(events);
    expect(await readFile(join(directory, 'profile', 'project.md'), 'utf8')).toBe(
      before.result.profile[0].content,
    );
    expect(new ProfileOrganizationStore(directory).get()).toEqual(moved.result);
    await request('/profile/organization', 'POST', {
      action: 'move',
      name: 'project.md',
      folder: '',
    });
    expect(new ProfileOrganizationStore(directory).get().locations['project.md']).toBe('');
  });

  it('rejects invalid folder paths and note names without changing saved organization', async () => {
    const { request, daemon } = await setup(4592);
    for (const path of [
      '../outside',
      '/absolute',
      'a/../b',
      'a\\b',
      'a//b',
      '.',
      'folder\u0000',
      Array(14).fill('deep').join('/'),
    ]) {
      const result = await request('/profile/organization', 'POST', { action: 'create', path });
      expect(result.response.status, path).toBeGreaterThanOrEqual(400);
    }
    const invalid = await request('/profile/organization', 'POST', {
      action: 'move',
      name: '../outside.md',
      folder: 'Projects',
    });
    expect(invalid.response.status).toBeGreaterThanOrEqual(400);
    expect(daemon.service.profileOrganization.get()).toEqual({
      version: 1,
      folders: [],
      locations: {},
    });
    await request('/profile/organization', 'POST', { action: 'create', path: 'Projects' });
    expect(
      (await request('/profile/organization', 'POST', { action: 'create', path: 'Projects' }))
        .response.status,
    ).toBeGreaterThanOrEqual(400);
    expect(daemon.service.profileOrganization.get().folders).toEqual(['Projects']);
  });

  it('requires the user session and protects internal state from returned snapshot mutation', async () => {
    const { daemon } = await setup(4593);
    const rejected = await fetch(`${daemon.url}/api/profile/organization`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create', path: 'Projects' }),
    });
    expect(rejected.status).toBeGreaterThanOrEqual(400);
    const state = daemon.service.profileOrganization.get();
    state.folders.push('Unsaved');
    state.locations['note.md'] = 'Unsaved';
    expect(daemon.service.profileOrganization.get()).toEqual({
      version: 1,
      folders: [],
      locations: {},
    });
  });
});
