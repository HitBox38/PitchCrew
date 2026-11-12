import type { ProfileFile, ProfileOrganization, ProfileSource } from '@pitchcrew/core';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);

type Renamed = { profile: ProfileFile[]; organization: ProfileOrganization };
type Deleted = { trashId: string; profile: ProfileFile[] };
type Restored = Renamed & { name: string };
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const names = (profile: ProfileFile[]) => profile.map((file) => file.name).sort();
const source = (name: string): ProfileSource => ({
  id: 'a'.repeat(24),
  input: { provider: 'github', repository: 'fictional/notes', path: 'about' },
  label: 'fictional/notes/about',
  importedAt: '2026-10-01T00:00:00.000Z',
  watching: true,
  files: [
    {
      key: 'about/Atlas.md',
      name,
      path: 'about/Atlas.md',
      url: 'https://github.com/fictional/notes/blob/main/about/Atlas.md',
      revision: 'b'.repeat(40),
      digest: 'c'.repeat(64),
    },
  ],
});

describe('profile note file management', () => {
  it('renames a note with its explicit folder and imported source record', async () => {
    const { request, directory } = await setup();
    await request('/profile', 'PUT', { name: 'atlas.md', content: '# Atlas\n\n- Fictional.' });
    await request('/profile', 'PUT', { name: 'taken.md', content: '# Taken' });
    await writeFile(join(directory, 'profile-sources.json'), JSON.stringify([source('atlas.md')]));
    await request('/profile/organization', 'POST', {
      action: 'move',
      name: 'atlas.md',
      folder: 'Projects/2026',
    });

    const renamed = await request<Renamed>('/profile/rename', 'POST', {
      from: 'atlas.md',
      to: 'atlas-planner.md',
    });
    expect(renamed.response.status).toBe(200);
    expect(names(renamed.result.profile)).toEqual(['atlas-planner.md', 'taken.md']);
    expect(renamed.result.organization.locations).toEqual({ 'atlas-planner.md': 'Projects/2026' });
    const sources = JSON.parse(
      await readFile(join(directory, 'profile-sources.json'), 'utf8'),
    ) as ProfileSource[];
    expect(sources[0].files[0].name).toBe('atlas-planner.md');
    expect(await readFile(join(directory, 'profile', 'atlas-planner.md'), 'utf8')).toBe(
      '# Atlas\n\n- Fictional.',
    );

    const collision = await request<{ error: string }>('/profile/rename', 'POST', {
      from: 'atlas-planner.md',
      to: 'taken.md',
    });
    expect(collision.response.status).toBe(400);
    expect(collision.result.error).toMatch(/already exists/);
    const missing = await request('/profile/rename', 'POST', { from: 'gone.md', to: 'x.md' });
    expect(missing.response.status).toBe(404);
    for (const to of ['../outside.md', 'note.txt', 'a/b.md'])
      expect(
        (await request('/profile/rename', 'POST', { from: 'taken.md', to })).response.status,
      ).toBe(400);

    const same = await request<Renamed>('/profile/rename', 'POST', {
      from: 'taken.md',
      to: 'taken.md',
    });
    expect(names(same.result.profile)).toEqual(['atlas-planner.md', 'taken.md']);

    const caseOnly = await request<Renamed>('/profile/rename', 'POST', {
      from: 'taken.md',
      to: 'Taken.md',
    });
    expect(caseOnly.response.status).toBe(200);
    expect(names(caseOnly.result.profile)).toEqual(['Taken.md', 'atlas-planner.md']);
    expect((await readdir(join(directory, 'profile'))).sort()).toEqual([
      'Taken.md',
      'atlas-planner.md',
    ]);
  });

  it('rejects renaming onto a filename an imported source still tracks', async () => {
    const { request, directory } = await setup();
    await request('/profile', 'PUT', { name: 'mine.md', content: '# Mine' });
    await writeFile(
      join(directory, 'profile-sources.json'),
      JSON.stringify([source('tracked.md')]),
    );
    const result = await request<{ error: string }>('/profile/rename', 'POST', {
      from: 'mine.md',
      to: 'tracked.md',
    });
    expect(result.response.status).toBe(400);
    expect(result.result.error).toMatch(/imported source/);
    expect(await readdir(join(directory, 'profile'))).toEqual(['mine.md']);
  });

  it('moves deleted notes to the trash and restores them with their folder', async () => {
    const { request, directory } = await setup();
    await request('/profile', 'PUT', { name: 'role.md', content: '# Role\n\n- Fictional.' });
    await request('/profile/organization', 'POST', {
      action: 'move',
      name: 'role.md',
      folder: 'Work/Example',
    });
    const stale = join(directory, 'profile-trash', '00000000-0000-4000-8000-000000000000');
    await mkdir(stale, { recursive: true });
    await writeFile(
      join(stale, 'meta.json'),
      JSON.stringify({ name: 'old.md', deletedAt: '2026-01-01T00:00:00.000Z' }),
    );

    const deleted = await request<Deleted>('/profile/role.md', 'DELETE');
    expect(deleted.response.status).toBe(200);
    expect(deleted.result.profile).toEqual([]);
    expect(deleted.result.trashId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await readdir(join(directory, 'profile-trash'))).toEqual([deleted.result.trashId]);
    expect(
      JSON.parse(
        await readFile(
          join(directory, 'profile-trash', deleted.result.trashId, 'meta.json'),
          'utf8',
        ),
      ),
    ).toMatchObject({ name: 'role.md', folder: 'Work/Example' });
    const organization = (
      await request<ProfileOrganization>('/profile/organization', 'POST', {
        action: 'delete-folder',
        path: 'Work',
      })
    ).result;
    expect(organization).toEqual({ version: 1, folders: [], locations: {} });
    expect((await request('/profile/role.md', 'DELETE')).response.status).toBe(404);

    const restored = await request<Restored>('/profile/restore', 'POST', {
      trashId: deleted.result.trashId,
    });
    expect(restored.response.status).toBe(200);
    expect(restored.result.name).toBe('role.md');
    expect(restored.result.profile).toEqual([
      { name: 'role.md', content: '# Role\n\n- Fictional.' },
    ]);
    expect(restored.result.organization).toEqual({
      version: 1,
      folders: ['Work', 'Work/Example'],
      locations: { 'role.md': 'Work/Example' },
    });
    expect(await readdir(join(directory, 'profile-trash'))).toEqual([]);
    expect(
      (await request('/profile/restore', 'POST', { trashId: deleted.result.trashId })).response
        .status,
    ).toBe(404);

    const again = await request<Deleted>('/profile/role.md', 'DELETE');
    await request('/profile', 'PUT', { name: 'role.md', content: '# Replacement' });
    const blocked = await request<{ error: string }>('/profile/restore', 'POST', {
      trashId: again.result.trashId,
    });
    expect(blocked.response.status).toBe(400);
    expect(blocked.result.error).toMatch(/already exists/);
    expect(await readFile(join(directory, 'profile', 'role.md'), 'utf8')).toBe('# Replacement');
  });

  it('detects save conflicts only when the client sends a baseline', async () => {
    const { request, directory } = await setup();
    const path = join(directory, 'profile', 'notes.md');
    const created = await request<ProfileFile[]>('/profile', 'PUT', {
      name: 'notes.md',
      content: 'first',
      baseline: null,
    });
    expect(created.response.status).toBe(200);
    expect(created.result).toEqual([{ name: 'notes.md', content: 'first' }]);
    const exists = await request<{ error: string; current: string | null }>('/profile', 'PUT', {
      name: 'notes.md',
      content: 'second',
      baseline: null,
    });
    expect(exists.response.status).toBe(409);
    expect(exists.result).toEqual({
      error: 'This note changed on disk since you opened it.',
      current: 'first',
    });
    await writeFile(path, 'edited elsewhere');
    const stale = await request<{ current: string | null }>('/profile', 'PUT', {
      name: 'notes.md',
      content: 'second',
      baseline: sha('first'),
    });
    expect(stale.response.status).toBe(409);
    expect(stale.result.current).toBe('edited elsewhere');
    expect(await readFile(path, 'utf8')).toBe('edited elsewhere');
    const missing = await request<{ current: string | null }>('/profile', 'PUT', {
      name: 'absent.md',
      content: 'x',
      baseline: sha('x'),
    });
    expect(missing.response.status).toBe(409);
    expect(missing.result.current).toBeNull();
    const current = await request('/profile', 'PUT', {
      name: 'notes.md',
      content: 'second',
      baseline: sha('edited elsewhere'),
    });
    expect(current.response.status).toBe(200);
    expect(await readFile(path, 'utf8')).toBe('second');
    const legacy = await request('/profile', 'PUT', { name: 'notes.md', content: 'third' });
    expect(legacy.response.status).toBe(200);
    expect(await readFile(path, 'utf8')).toBe('third');
    expect(
      (await request('/profile', 'PUT', { name: 'notes.md', content: 'x', baseline: 'ABC' }))
        .response.status,
    ).toBe(400);
  });

  it('never lets a new note overwrite another note that differs only in capitals', async () => {
    const { request, directory } = await setup();
    await request('/profile', 'PUT', { name: 'race.md', content: 'original' });
    const created = await request<{ error: string }>('/profile', 'PUT', {
      name: 'Race.md',
      content: 'new note',
      baseline: null,
    });
    // A case-sensitive disk simply holds both notes; a case-insensitive one must refuse.
    const caseInsensitive = await readFile(join(directory, 'profile', 'RACE.md'), 'utf8').then(
      () => true,
      () => false,
    );
    if (caseInsensitive) {
      expect(created.response.status).toBe(400);
      expect(created.result.error).toMatch(/different capitals/);
      expect(await readFile(join(directory, 'profile', 'race.md'), 'utf8')).toBe('original');
    } else expect(created.response.status).toBe(200);
  });

  it('renames and deletes folders with their descendants under explorer rules', async () => {
    const { request, daemon } = await setup();
    await request('/profile', 'PUT', { name: 'a.md', content: 'A' });
    const change = (command: object) =>
      request<ProfileOrganization & { error?: string }>('/profile/organization', 'POST', command);
    await change({ action: 'create', path: 'Work/Example/Notes' });
    await change({ action: 'create', path: 'Other' });
    await change({ action: 'move', name: 'a.md', folder: 'Work/Example' });
    await change({ action: 'move', name: 'ghost.md', folder: 'Other' });

    const renamed = await change({ action: 'rename-folder', from: 'Work', to: 'Jobs/Past' });
    expect(renamed.response.status).toBe(200);
    expect([...renamed.result.folders].sort()).toEqual(
      ['Jobs', 'Jobs/Past', 'Jobs/Past/Example', 'Jobs/Past/Example/Notes', 'Other'].sort(),
    );
    expect(renamed.result.locations).toEqual({ 'a.md': 'Jobs/Past/Example', 'ghost.md': 'Other' });
    for (const command of [
      { action: 'rename-folder', from: 'Jobs/Past', to: 'Other' },
      { action: 'rename-folder', from: 'Jobs', to: 'Jobs/Inner' },
      { action: 'rename-folder', from: 'Missing', to: 'Elsewhere' },
      { action: 'rename-folder', from: 'Jobs', to: '../outside' },
      { action: 'delete-folder', path: 'Jobs' },
      { action: 'delete-folder', path: 'Jobs/Past/Example' },
      { action: 'delete-folder', path: 'Missing' },
    ])
      expect((await change(command)).response.status, JSON.stringify(command)).toBe(400);
    expect(daemon.service.profileOrganization.get()).toEqual(renamed.result);

    const removed = await change({ action: 'delete-folder', path: 'Jobs/Past/Example/Notes' });
    expect(removed.result.folders).not.toContain('Jobs/Past/Example/Notes');
    // A location for a note that no longer exists does not block deleting its folder.
    const other = await change({ action: 'delete-folder', path: 'Other' });
    expect(other.result.folders).not.toContain('Other');
    expect(other.result.locations).toEqual({ 'a.md': 'Jobs/Past/Example' });
  });

  it('blocks note saves, renames, deletes and restores while a run is active', async () => {
    const { request, daemon, directory } = await setup();
    await request('/profile', 'PUT', { name: 'busy.md', content: 'Busy' });
    const trashed = await request<Deleted>('/profile/busy.md', 'DELETE');
    await request('/profile', 'PUT', { name: 'busy.md', content: 'Busy' });
    daemon.service.controllers.set('profile-notes-fixture', new AbortController());
    const attempts = [
      request<{ error: string }>('/profile', 'PUT', { name: 'busy.md', content: 'Changed' }),
      request<{ error: string }>('/profile/rename', 'POST', { from: 'busy.md', to: 'idle.md' }),
      request<{ error: string }>('/profile/busy.md', 'DELETE'),
      request<{ error: string }>('/profile/restore', 'POST', { trashId: trashed.result.trashId }),
    ];
    for (const attempt of await Promise.all(attempts)) {
      expect(attempt.response.status).toBe(400);
      expect(attempt.result.error).toMatch(/active runs/);
    }
    daemon.service.controllers.delete('profile-notes-fixture');
    expect(await readdir(join(directory, 'profile'))).toEqual(['busy.md']);
    expect(await readFile(join(directory, 'profile', 'busy.md'), 'utf8')).toBe('Busy');
  });

  it('lists deleted notes newest first until they are restored', async () => {
    const { request } = await setup();
    await request('/profile', 'PUT', { name: 'one.md', content: '# One' });
    await request('/profile', 'PUT', { name: 'two.md', content: '# Two' });
    const first = await request<Deleted>('/profile/one.md', 'DELETE');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await request<Deleted>('/profile/two.md', 'DELETE');
    const listed = await request<{ trashId: string; name: string }[]>('/profile/trash');
    expect(listed.result.map((entry) => entry.name)).toEqual(['two.md', 'one.md']);
    await request('/profile/restore', 'POST', { trashId: first.result.trashId });
    const after = await request<{ name: string }[]>('/profile/trash');
    expect(after.result.map((entry) => entry.name)).toEqual(['two.md']);
  });
});
