import type { Run, Skill, SkillPreview, Snapshot } from '@pitchcrew/core';
import { baseSkills, baseSkillUrl } from '@pitchcrew/core/base-skills';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapters } from '@pitchcrew/adapters';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { skillDirectory } from '../src/skills-directory.ts';
import { cleanup, finish, setup, starterFixture } from './helpers/daemon.ts';

afterEach(cleanup);
describe('starter skills at workspace startup', () => {
  it.each(baseSkills.filter((item) => item.sourceType === 'bundled'))(
    'bundles $name offline with scoped assignment and preserves edits, renames and deletion',
    async (starter) => {
      vi.spyOn(skillDirectory, 'preview').mockRejectedValue(new Error('Offline fixture.'));
      const { daemon, directory, request } = await setup(14457, true);
      const guard = daemon.service.skills().find((skill) => skill.name === starter.name)!;
      expect(guard).toMatchObject({
        bundledId: starter.name,
        scope: starter.defaultScope ?? 'roles',
        roleIds: starter.defaultRoles,
      });
      expect(guard.source).toBeUndefined();
      for (const role of daemon.service.board.list<import('@pitchcrew/core').Role>('role')) {
        expect(daemon.service.skills(role.id).some((skill) => skill.id === guard.id)).toBe(
          starter.defaultScope === 'all' || starter.defaultRoles.includes(role.id),
        );
      }
      await daemon.service.createRole({
        id: 'future-agent',
        name: 'Future agent',
        description: 'Fictional future agent.',
        runtime: 'demo',
        model: '',
        enabled: true,
        instructions: 'Use scoped tools.',
      });
      expect(daemon.service.skills('future-agent').some((skill) => skill.id === guard.id)).toBe(
        starter.defaultScope === 'all',
      );
      const roleId = starter.defaultScope === 'all' ? 'future-agent' : starter.defaultRoles[0]!;
      const chat = vi.spyOn(adapters.demo, 'chat');
      const run = (
        await request<Run>(`/roles/${roleId}/chat`, 'POST', { content: 'Use my assigned skills.' })
      ).result;
      await finish(request, run.id);
      expect(chat.mock.calls[0]![0].skills).toContainEqual(guard);
      expect(
        await readFile(
          join(directory, 'roles', roleId, 'runs', run.id, 'skills', guard.id, 'SKILL.md'),
          'utf8',
        ),
      ).toContain(guard.content);
      const edited = (
        await request<Skill>(`/skills/${guard.id}`, 'PUT', {
          name: 'My renamed bundled skill',
          description: 'User-managed instructions.',
          content: 'Preserve my reviewed instructions.',
          scope: 'roles',
          roleIds: ['scout'],
        })
      ).result;
      expect(edited.bundledId).toBe(starter.name);
      daemon.service.board.rebuild();
      await daemon.service.initialize(true);
      const bundled = () =>
        daemon.service.skills().filter((skill) => skill.bundledId === starter.name);
      expect(bundled()).toEqual([edited]);
      await request(`/skills/${guard.id}`, 'DELETE');
      await request('/skills/starter/retry', 'POST');
      expect(bundled()).toEqual([]);
      const restored = (
        await request<Skill>('/skills', 'POST', {
          ...starterFixture(starter),
          scope: 'all',
          roleIds: [],
        })
      ).result;
      expect(restored.id).not.toBe(guard.id);
      expect(restored.bundledId).toBe(starter.name);
      await request('/skills/starter/retry', 'POST');
      expect(bundled()).toEqual([restored]);
      expect(
        (
          await request('/skills', 'POST', {
            ...starterFixture(starter),
            bundledId: 'unknown-bundle',
            scope: 'all',
            roleIds: [],
          })
        ).response.status,
      ).toBe(400);
    },
  );

  it('loads defaults before the first snapshot and respects edits, renames and deletions on restart and replay', async () => {
    const preview = vi
      .spyOn(skillDirectory, 'preview')
      .mockImplementation(async (url) =>
        starterFixture(baseSkills.find((item) => baseSkillUrl(item) === url)!),
      );
    const { daemon, request } = await setup(14453, true);
    const snapshot = (await request<Snapshot>('/snapshot')).result;
    expect(snapshot.skills).toHaveLength(12);
    expect(snapshot.starterSkillErrors).toEqual([]);
    expect(preview).toHaveBeenCalledTimes(10);
    for (const starter of baseSkills)
      expect(snapshot.skills.find((skill) => skill.name === starter.name)).toMatchObject({
        scope: starter.defaultScope ?? 'roles',
        roleIds: starter.defaultScope === 'all' ? [] : starter.defaultRoles,
      });
    const cover = snapshot.skills.find((skill) => skill.name === 'cover-letter')!;
    const humanizer = snapshot.skills.find((skill) => skill.name === 'humanizer')!;
    expect(
      (
        await request(`/skills/${cover.id}`, 'PUT', {
          name: 'My application style',
          description: cover.description,
          content: 'User edited instructions.',
          scope: cover.scope,
          roleIds: cover.roleIds,
        })
      ).response.status,
    ).toBe(200);
    await request(`/skills/${humanizer.id}`, 'DELETE');
    const article = snapshot.skills.find((skill) => skill.name === 'article-writing')!;
    daemon.service.saveSkill(
      {
        name: 'My renamed article skill',
        description: article.description,
        content: article.content,
        scope: article.scope,
        roleIds: article.roleIds,
        source: {
          ...article.source!,
          repository: 'affaan-m/everything-claude-code',
          url: 'https://skills.sh/affaan-m/everything-claude-code/article-writing',
        },
      },
      article.id,
    );
    daemon.service.deleteSkill(article.id);
    daemon.service.board.rebuild();
    await daemon.service.initialize(true);
    expect(preview).toHaveBeenCalledTimes(10);
    expect(daemon.service.skills()).toHaveLength(10);
    expect(daemon.service.skills().find((skill) => skill.id === cover.id)?.content).toBe(
      'User edited instructions.',
    );
    expect(daemon.service.skills().some((skill) => skill.name === 'humanizer')).toBe(false);
    expect(
      daemon.service.board.events().filter((event) => event.message.startsWith('Loaded starter')),
    ).toHaveLength(12);
  });
  it('starts with partial failures and retries latest sources without restoring a deleted starter', async () => {
    let unavailable = true;
    const preview = vi.spyOn(skillDirectory, 'preview').mockImplementation(async (url) => {
      const starter = baseSkills.find((item) => baseSkillUrl(item) === url)!;
      if (starter.name === 'research' && unavailable) throw new Error('Upstream file unavailable.');
      return starterFixture(
        starter,
        unavailable ? 'First version.' : 'Latest source instructions.',
      );
    });
    const { daemon, request } = await setup(14454, true);
    expect(daemon.service.skills()).toHaveLength(11);
    expect((await daemon.service.snapshot()).starterSkillErrors).toEqual([
      { name: 'research', error: 'Upstream file unavailable.' },
    ]);
    const cover = daemon.service.skills().find((skill) => skill.name === 'cover-letter')!;
    await request(`/skills/${cover.id}`, 'DELETE');
    unavailable = false;
    expect((await request('/skills/starter/retry', 'POST')).response.status).toBe(200);
    expect(preview).toHaveBeenCalledTimes(11);
    expect((await daemon.service.snapshot()).starterSkillErrors).toEqual([]);
    expect(daemon.service.skills().find((skill) => skill.name === 'research')?.content).toBe(
      'Latest source instructions.',
    );
    expect(daemon.service.skills().some((skill) => skill.id === cover.id)).toBe(false);
    expect(daemon.service.skills().find((skill) => skill.name === 'humanizer')?.content).toBe(
      'First version.',
    );
    expect(
      (
        await request('/skills/starter/retry', 'POST', undefined, {
          origin: 'https://example.invalid',
        })
      ).response.status,
    ).toBe(403);
  });
  it('does not overwrite or resurrect a user skill added and removed during concurrent loading', async () => {
    const { daemon } = await setup(14452);
    const starter = baseSkills.find((item) => item.name === 'humanizer')!;
    let release!: (preview: SkillPreview) => void;
    const pending = new Promise<SkillPreview>((resolve) => {
      release = resolve;
    });
    vi.spyOn(skillDirectory, 'preview').mockImplementation(async (url) =>
      url === baseSkillUrl(starter)
        ? pending
        : starterFixture(baseSkills.find((item) => baseSkillUrl(item) === url)!),
    );
    const first = daemon.service.seedStarterSkills();
    const second = daemon.service.seedStarterSkills();
    const userSkill = daemon.service.saveSkill({
      ...starterFixture(starter),
      scope: 'roles',
      roleIds: ['reviewer'],
    });
    daemon.service.deleteSkill(userSkill.id);
    release(starterFixture(starter));
    await Promise.all([first, second]);
    expect(daemon.service.skills()).toHaveLength(11);
    expect(
      daemon.service.board.list<Skill>('skill').filter((skill) => skill.name === 'humanizer'),
    ).toHaveLength(1);
  });
  it('remains usable offline and reports source errors without storing placeholder instructions', async () => {
    vi.spyOn(skillDirectory, 'preview').mockRejectedValue(new Error('Offline fixture.'));
    const { daemon } = await setup(14450, true);
    const snapshot = await daemon.service.snapshot();
    expect(snapshot.skills).toHaveLength(2);
    expect(snapshot.skills.find((skill) => skill.name === 'prompt-injection-guard')).toMatchObject({
      name: 'prompt-injection-guard',
      scope: 'all',
      roleIds: [],
      bundledId: 'prompt-injection-guard',
    });
    expect(snapshot.skills.find((skill) => skill.name === 'improve-system')).toMatchObject({
      scope: 'roles',
      roleIds: ['pipeline-coach'],
      bundledId: 'improve-system',
    });
    expect(snapshot.skills.every((skill) => !skill.source)).toBe(true);
    expect(snapshot.starterSkillErrors).toHaveLength(10);
  });
});

it('loads starter sources while native catalogs are pending, but waits for complete role and skill setup before readiness', async () => {
  for (const adapter of Object.values(adapters))
    vi.spyOn(adapter, 'detect').mockResolvedValue({
      id: adapter.id,
      available: adapter.id === 'codex',
      version: 'fixture',
      detail: '',
    });
  let release!: () => void;
  const catalog = new Promise<typeof adapters.codex.models>((resolve) => {
    release = () => resolve(adapters.codex.models);
  });
  const models = vi.spyOn(adapters.codex, 'listModels').mockReturnValue(catalog);
  const preview = vi
    .spyOn(skillDirectory, 'preview')
    .mockImplementation(async (url) =>
      starterFixture(baseSkills.find((item) => baseSkillUrl(item) === url)!),
    );
  let ready = false;
  const starting = setup(15011, true, { dev: false }).then((workspace) => {
    ready = true;
    return workspace;
  });
  try {
    await vi.waitFor(() => expect(models).toHaveBeenCalledOnce());
    expect(ready).toBe(false);
    expect(preview).toHaveBeenCalledTimes(10);
  } finally {
    release();
    await starting;
  }
  const { request } = await starting;
  const snapshot = (await request<Snapshot>('/snapshot')).result;
  expect(snapshot.roles).toHaveLength(7);
  expect(snapshot.roles.every((role) => !role.enabled)).toBe(true);
  expect(snapshot.skills).toHaveLength(12);
  expect(snapshot.starterSkillErrors).toEqual([]);
});
