import type { Skill, SkillPreview, Snapshot } from '@pitchcrew/core';
import { baseSkills, baseSkillUrl } from '@pitchcrew/core/base-skills';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { skillDirectory } from '../src/skills-directory.ts';
import { cleanup, setup, starterFixture } from './helpers/daemon.ts';

afterEach(cleanup);
describe('starter skills at workspace startup', () => {
  it('loads defaults before the first snapshot and respects edits, renames and deletions on restart and replay', async () => {
    const preview = vi
      .spyOn(skillDirectory, 'preview')
      .mockImplementation(async (url) =>
        starterFixture(baseSkills.find((item) => baseSkillUrl(item) === url)!),
      );
    const { daemon, request } = await setup(14453, true);
    const snapshot = (await request<Snapshot>('/snapshot')).result;
    expect(snapshot.skills).toHaveLength(10);
    expect(snapshot.starterSkillErrors).toEqual([]);
    expect(preview).toHaveBeenCalledTimes(10);
    for (const starter of baseSkills)
      expect(snapshot.skills.find((skill) => skill.name === starter.name)).toMatchObject({
        scope: 'roles',
        roleIds: starter.defaultRoles,
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
    expect(daemon.service.skills()).toHaveLength(8);
    expect(daemon.service.skills().find((skill) => skill.id === cover.id)?.content).toBe(
      'User edited instructions.',
    );
    expect(daemon.service.skills().some((skill) => skill.name === 'humanizer')).toBe(false);
    expect(
      daemon.service.board.events().filter((event) => event.message.startsWith('Loaded starter')),
    ).toHaveLength(10);
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
    expect(daemon.service.skills()).toHaveLength(9);
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
    expect(daemon.service.skills()).toHaveLength(9);
    expect(
      daemon.service.board.list<Skill>('skill').filter((skill) => skill.name === 'humanizer'),
    ).toHaveLength(1);
  });
  it('remains usable offline and reports source errors without storing placeholder instructions', async () => {
    vi.spyOn(skillDirectory, 'preview').mockRejectedValue(new Error('Offline fixture.'));
    const { daemon } = await setup(14450, true);
    const snapshot = await daemon.service.snapshot();
    expect(snapshot.skills).toEqual([]);
    expect(snapshot.starterSkillErrors).toHaveLength(10);
  });
});
