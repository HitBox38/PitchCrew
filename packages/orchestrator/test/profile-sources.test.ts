import type { ProfileSource, ProfileSourcePreview, Snapshot } from '@pitchcrew/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lintPacket } from '@pitchcrew/packet';
import { ProfileSourceManager } from '../src/profile-sources/index.ts';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);
const input = { provider: 'github', repository: 'fictional/resumes', path: 'about-me' };
const sha = 'a'.repeat(40);
function githubFixture(daemon: Awaited<ReturnType<typeof setup>>['daemon']) {
  const documents = new Map([
    [
      'about-me/LinkedIn-About.md',
      '# Fictional applicant\n\n- Built an accessible scheduling tool.',
    ],
    ['about-me/Projects/Atlas.md', '# Atlas\n\n- Reduced fictional deployment time by half.'],
    [
      'about-me/Work Experience/Example/CONTEXT.md',
      '# Example\n\n- Led a fictional team of three.',
    ],
  ]);
  const spy = vi.spyOn(daemon.service.connectors, 'call').mockImplementation(async (name, raw) => {
    const request = raw as { path: string; ref: string };
    if (name === 'github_get_revision') return { sha };
    expect(name).toBe('github_read_file');
    expect(request.ref).toBe(sha);
    if (documents.has(request.path))
      return { text: documents.get(request.path), sha: 'b'.repeat(40) };
    const prefix = request.path + '/';
    const entries = new Map<string, { path: string; type: string }>();
    for (const path of documents.keys()) {
      if (!path.startsWith(prefix)) continue;
      const child = prefix + path.slice(prefix.length).split('/')[0];
      entries.set(child, { path: child, type: path === child ? 'file' : 'dir' });
    }
    if (request.path === 'about-me') {
      entries.set('about-me/.agents', { path: 'about-me/.agents', type: 'dir' });
      entries.set('about-me/resumes', { path: 'about-me/resumes', type: 'dir' });
      entries.set('about-me/AGENTS.md', { path: 'about-me/AGENTS.md', type: 'file' });
      entries.set('about-me/profile.pdf', { path: 'about-me/profile.pdf', type: 'file' });
    }
    return { entries: [...entries.values()] };
  });
  return { documents, spy };
}
describe('reviewed profile sources', () => {
  it('imports only selected exact reviewed files, pins nested reads, persists provenance and consumes previews', async () => {
    const { daemon, directory, request } = await setup(14501);
    const { documents, spy } = githubFixture(daemon);
    const preview = (await request<ProfileSourcePreview>('/profile/sources/preview', 'POST', input))
      .result;
    expect(preview.files).toHaveLength(3);
    expect(preview.files.every((file) => file.status === 'new')).toBe(true);
    expect((await request<Snapshot>('/snapshot')).result.profile).toEqual([]);
    const selected = preview.files.filter(
      (file) => file.path.includes('LinkedIn') || file.path.includes('Work Experience'),
    );
    documents.set(selected[0].path, 'Changed remotely after review');
    const calls = spy.mock.calls.length;
    const saved = await request('/profile/sources/import', 'POST', {
      token: preview.token,
      names: selected.map((file) => file.name),
    });
    expect(saved.response.status).toBe(200);
    expect(spy.mock.calls).toHaveLength(calls);
    const snapshot = (await request<Snapshot>('/snapshot')).result;
    expect(snapshot.profile).toHaveLength(2);
    const quote = 'Built an accessible scheduling tool.';
    expect(
      lintPacket(
        {
          resume: quote,
          coverLetter: 'A fictional introduction.',
          formAnswers: '',
          note: '',
          claims: [{ claim: quote, source: selected[0].name, quote }],
        },
        snapshot.profile,
      ),
    ).toEqual([]);

    for (const file of selected)
      expect(snapshot.profile.find((note) => note.name === file.name)?.content).toBe(file.content);
    const sources = (await request<ProfileSource[]>('/profile/sources')).result;
    expect(sources[0].files.map((file) => file.path)).toEqual(selected.map((file) => file.path));
    expect(sources[0].files[0].url).toContain(`/blob/${sha}/`);
    expect(await new ProfileSourceManager(directory, daemon.service.connectors).list()).toEqual(
      sources,
    );
    expect(JSON.parse(await readFile(join(directory, 'profile-sources.json'), 'utf8'))).toEqual(
      sources,
    );
    expect(
      (
        await request('/profile/sources/import', 'POST', {
          token: preview.token,
          names: [selected[0].name],
        })
      ).response.status,
    ).toBe(400);
    expect((await request(`/profile/sources/${sources[0].id}`, 'DELETE')).response.status).toBe(
      200,
    );
    expect((await request<Snapshot>('/snapshot')).result.profile).toHaveLength(2);
    expect((await request<ProfileSource[]>('/profile/sources')).result).toEqual([]);
  });
  it('flags local edits, preserves removed documents and rejects notes edited since preview', async () => {
    const { daemon, request } = await setup(14502);
    const { documents } = githubFixture(daemon);
    const preview = (await request<ProfileSourcePreview>('/profile/sources/preview', 'POST', input))
      .result;
    await request('/profile/sources/import', 'POST', {
      token: preview.token,
      names: preview.files.map((file) => file.name),
    });
    const project = preview.files.find((file) => file.path.includes('Projects'))!;
    const about = preview.files.find((file) => file.path.includes('LinkedIn'))!;
    await request('/profile', 'PUT', { name: project.name, content: 'My local edit' });
    documents.set(project.path, 'Upstream project change');
    documents.set(about.path, 'Upstream bio change');
    documents.delete(preview.files.find((file) => file.path.includes('Work Experience'))!.path);
    const refresh = (await request<ProfileSourcePreview>('/profile/sources/preview', 'POST', input))
      .result;
    expect(refresh.files.find((file) => file.name === project.name)?.status).toBe('conflict');
    expect(refresh.files.find((file) => file.name === about.name)?.status).toBe('changed');
    expect(refresh.missing).toHaveLength(1);
    await request('/profile', 'PUT', { name: about.name, content: 'Edited after preview' });
    const failed = await request<{ error: string }>('/profile/sources/import', 'POST', {
      token: refresh.token,
      names: [about.name],
    });
    expect(failed.result.error).toContain('changed after preview');
    const current = (await request<ProfileSourcePreview>('/profile/sources/preview', 'POST', input))
      .result;
    await request('/profile/sources/import', 'POST', { token: current.token, names: [about.name] });
    const notes = (await request<Snapshot>('/snapshot')).result.profile;
    expect(notes.find((note) => note.name === project.name)?.content).toBe('My local edit');
    expect(notes.find((note) => note.name === about.name)?.content).toBe('Upstream bio change');
    expect(notes).toHaveLength(3);
  });
  it('rejects unauthorized source access, path traversal, payload changes, oversized documents and active-run mutations', async () => {
    const { daemon, request } = await setup(14503);
    const { documents, spy } = githubFixture(daemon);
    expect(
      (
        await fetch(`${daemon.url}/api/profile/sources/preview`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        })
      ).status,
    ).toBe(403);
    for (const path of ['../profile', '/absolute', 'about-me/../profile', 'about-me\\profile'])
      expect(
        (await request('/profile/sources/preview', 'POST', { ...input, path })).response.status,
      ).toBe(400);
    expect(spy).not.toHaveBeenCalled();
    const preview = (await request<ProfileSourcePreview>('/profile/sources/preview', 'POST', input))
      .result;
    expect(
      (
        await request('/profile/sources/import', 'POST', {
          token: preview.token,
          names: ['../../escape.md'],
        })
      ).response.status,
    ).toBe(400);
    expect(
      (
        await request('/profile/sources/import', 'POST', {
          token: preview.token,
          names: [preview.files[0].name],
          content: 'Injected content',
        })
      ).response.status,
    ).toBe(400);
    daemon.service.controllers.set('fixture-active-run', new AbortController());
    const blocked = await request<{ error: string }>('/profile/sources/import', 'POST', {
      token: preview.token,
      names: [preview.files[0].name],
    });
    expect(blocked.result.error).toContain('active runs');
    daemon.service.controllers.delete('fixture-active-run');
    documents.set('about-me/LinkedIn-About.md', 'x'.repeat(50001));
    expect((await request('/profile/sources/preview', 'POST', input)).response.status).toBe(400);
    expect((await request<Snapshot>('/snapshot')).result.profile).toEqual([]);
  });
  it('serializes profile writes and refuses chat or workflow launches during an import', async () => {
    const { daemon, request } = await setup(14507);
    await daemon.service.saveProfile(
      'fictional.md',
      '# Fictional applicant\n\n- Built a scheduling tool.',
    );
    let release: (value: { name: string; content: string }[]) => void = () => {};
    vi.spyOn(daemon.service.profileSources, 'import').mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = daemon.service.importProfileSource({});
    const card = daemon.service.createCard({
      company: 'Fictional',
      title: 'Engineer',
      url: 'https://example.com/job',
      jobPost: 'Fictional job',
    });
    const workflow = await request<{ error: string }>(`/cards/${card.id}/run`, 'POST', {
      roleId: 'scout',
    });
    expect(workflow.result.error).toContain('profile update');
    const chat = await request<{ error: string }>('/roles/scout/chat', 'POST', {
      content: 'Fictional question',
    });
    expect(chat.result.error).toContain('profile update');
    await expect(daemon.service.saveProfile('second.md', 'Concurrent edit')).rejects.toThrow(
      'current profile update',
    );
    release([]);
    await pending;
    expect((await request<Snapshot>('/snapshot')).result.runs).toEqual([]);
    await expect(
      daemon.service.saveProfile('second.md', '# Another fictional fact'),
    ).resolves.toHaveLength(2);
  });
  it('expires reviewed snapshots without saving source content', async () => {
    const { daemon, request } = await setup(14504);
    githubFixture(daemon);
    const preview = (await request<ProfileSourcePreview>('/profile/sources/preview', 'POST', input))
      .result;
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 11 * 60000);
    const result = await request<{ error: string }>('/profile/sources/import', 'POST', {
      token: preview.token,
      names: [preview.files[0].name],
    });
    expect(result.result.error).toContain('expired');
    expect((await request<Snapshot>('/snapshot')).result.profile).toEqual([]);
  });
  it('reads paginated nested Drive documents, skips PDFs and retains stable identity when a document is renamed', async () => {
    const { daemon, request } = await setup(14505);
    let name = 'Background';
    vi.spyOn(daemon.service.connectors, 'call').mockImplementation(async (tool, value) => {
      const args = value as { fileId: string; query: string; pageToken?: string };
      if (tool === 'google_drive_get_file')
        return {
          data:
            args.fileId === 'root'
              ? { name: 'Profile', mimeType: 'application/vnd.google-apps.folder' }
              : { name, modifiedTime: '2026-10-01' },
        };
      if (tool === 'google_drive_search_files') {
        if (args.query.includes("'nested'"))
          return {
            data: {
              files: [
                {
                  id: 'text',
                  name: 'Project.md',
                  mimeType: 'text/markdown',
                  modifiedTime: '2026-10-01',
                },
              ],
            },
          };
        if (args.pageToken)
          return {
            data: {
              files: [
                { id: 'nested', name: 'Projects', mimeType: 'application/vnd.google-apps.folder' },
                { id: 'pdf', name: 'Resume.pdf', mimeType: 'application/pdf' },
              ],
            },
          };
        return {
          data: {
            nextPageToken: 'page-2',
            files: [
              {
                id: 'doc',
                name,
                mimeType: 'application/vnd.google-apps.document',
                modifiedTime: '2026-10-01',
              },
            ],
          },
        };
      }
      return {
        data: {
          text:
            tool === 'google_docs_get_document' ? '# Fictional background' : '# Fictional project',
        },
      };
    });
    const drive = { provider: 'drive', folderId: 'root' };
    const preview = (await request<ProfileSourcePreview>('/profile/sources/preview', 'POST', drive))
      .result;
    expect(preview.files.map((file) => file.path)).toEqual([
      'Profile/Background',
      'Profile/Projects/Project.md',
    ]);
    await request('/profile/sources/import', 'POST', {
      token: preview.token,
      names: preview.files.map((file) => file.name),
    });
    name = 'Biography';
    const renamed = (await request<ProfileSourcePreview>('/profile/sources/preview', 'POST', drive))
      .result;
    expect(renamed.files[0].name).toBe(preview.files[0].name);
    expect(renamed.files[0].path).toBe('Profile/Biography');
    expect(renamed.files[0].status).toBe('unchanged');
    expect(renamed.missing).toEqual([]);
  });
  it('rolls back imported file replacements if committing source metadata fails', async () => {
    const { daemon, request } = await setup(14506);
    const { documents } = githubFixture(daemon);
    const original = (
      await request<ProfileSourcePreview>('/profile/sources/preview', 'POST', input)
    ).result;
    const names = original.files.map((file) => file.name);
    await request('/profile/sources/import', 'POST', { token: original.token, names });
    const sources = (await request<ProfileSource[]>('/profile/sources')).result;
    for (const key of documents.keys()) documents.set(key, 'Upstream replacement');
    const preview = (await request<ProfileSourcePreview>('/profile/sources/preview', 'POST', input))
      .result;
    const manager = daemon.service.profileSources as unknown as {
      store: (sources: ProfileSource[]) => Promise<void>;
    };
    vi.spyOn(manager, 'store').mockRejectedValueOnce(new Error('Fixture disk write failure'));
    expect(
      (await request('/profile/sources/import', 'POST', { token: preview.token, names })).response
        .status,
    ).toBe(400);
    const notes = (await request<Snapshot>('/snapshot')).result.profile;
    expect(notes).toHaveLength(original.files.length);
    for (const file of original.files)
      expect(notes.find((note) => note.name === file.name)?.content).toBe(file.content);
    expect((await request<ProfileSource[]>('/profile/sources')).result).toEqual(sources);
  });
});
