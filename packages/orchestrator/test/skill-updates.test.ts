import type { Skill, SkillPreview, SkillUpdatePreview } from '@pitchcrew/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { skillDirectory } from '../src/skills-directory.ts';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanup();
});
const source = {
  url: 'https://skills.sh/fictional/crew-skills/evidence-checklist',
  repository: 'fictional/crew-skills',
  path: 'skills/evidence-checklist/SKILL.md',
  blobSha: 'a'.repeat(40),
  fetchedAt: '2026-10-01T00:00:00.000Z',
};
const input = {
  name: 'Evidence checklist',
  description: 'Check claims.',
  content: '# Evidence\n\nCheck exact quotes.',
  scope: 'roles',
  roleIds: ['reviewer'],
  source,
};
const latest: SkillPreview = {
  name: 'Updated evidence checklist',
  description: 'Check all claims.',
  content: '# Evidence\n\nCheck exact quotes and dates.',
  source: { ...source, blobSha: 'b'.repeat(40), fetchedAt: '2026-10-14T00:00:00.000Z' },
};

describe('user-reviewed registry skill updates', () => {
  it('checks without writes and applies the exact reviewed snapshot only after explicit approval', async () => {
    const { daemon, request } = await setup(15081);
    const { result: skill } = await request<Skill>('/skills', 'POST', input);
    const load = vi.spyOn(skillDirectory, 'preview').mockResolvedValue(latest);
    const events = daemon.service.board.events();
    const { result: review, response } = await request<SkillUpdatePreview>(
      `/skills/${skill.id}/update/preview`,
      'POST',
    );
    expect(response.status).toBe(200);
    expect(review).toMatchObject({ current: skill, latest, changed: true });
    expect(daemon.service.board.events()).toEqual(events);
    expect(
      (
        await request(`/skills/${skill.id}/update/approve`, 'POST', {
          previewId: review.id,
          approved: false,
        })
      ).response.status,
    ).toBe(400);
    load.mockResolvedValue({ ...latest, content: 'Upstream changed after review.' });
    const { result: updated, response: approved } = await request<Skill>(
      `/skills/${skill.id}/update/approve`,
      'POST',
      { previewId: review.id, approved: true },
    );
    expect(approved.status).toBe(200);
    expect(updated).toMatchObject({
      ...latest,
      id: skill.id,
      createdAt: skill.createdAt,
      scope: skill.scope,
      roleIds: skill.roleIds,
    });
    expect(load).toHaveBeenCalledOnce();
    expect(
      daemon.service.board
        .events()
        .filter((event) => event.kind === 'skill')
        .every((event) => event.actor === 'user'),
    ).toBe(true);
    daemon.service.board.rebuild();
    expect(daemon.service.skills()).toEqual([updated]);
    expect(
      (
        await request(`/skills/${skill.id}/update/approve`, 'POST', {
          previewId: review.id,
          approved: true,
        })
      ).response.status,
    ).toBe(400);
  });

  it('reports unchanged skills without events, but shows local edits even at the same source revision', async () => {
    const { daemon, request } = await setup(15082);
    const { result: skill } = await request<Skill>('/skills', 'POST', input);
    vi.spyOn(skillDirectory, 'preview').mockResolvedValue({
      name: input.name,
      description: input.description,
      content: input.content,
      source: { ...source, fetchedAt: latest.source!.fetchedAt },
    });
    const events = daemon.service.board.events();
    expect(
      (await request<SkillUpdatePreview>(`/skills/${skill.id}/update/preview`, 'POST')).result
        .changed,
    ).toBe(false);
    expect(daemon.service.board.events()).toEqual(events);
    await request(`/skills/${skill.id}`, 'PUT', {
      ...input,
      content: 'Local custom instructions.',
    });
    expect(
      (await request<SkillUpdatePreview>(`/skills/${skill.id}/update/preview`, 'POST')).result
        .changed,
    ).toBe(true);
  });

  it('rejects stale, mismatched, deleted and expired reviews without writes', async () => {
    const { daemon, request } = await setup(15083);
    const { result: skill } = await request<Skill>('/skills', 'POST', input);
    const { result: other } = await request<Skill>('/skills', 'POST', {
      ...input,
      name: 'Other skill',
    });
    vi.spyOn(skillDirectory, 'preview').mockResolvedValue(latest);
    const { result: review } = await request<SkillUpdatePreview>(
      `/skills/${skill.id}/update/preview`,
      'POST',
    );
    expect(
      (
        await request(`/skills/${other.id}/update/approve`, 'POST', {
          previewId: review.id,
          approved: true,
        })
      ).response.status,
    ).toBe(400);
    await request(`/skills/${skill.id}`, 'PUT', { ...input, roleIds: ['writer'] });
    let events = daemon.service.board.events();
    expect(
      (
        await request(`/skills/${skill.id}/update/approve`, 'POST', {
          previewId: review.id,
          approved: true,
        })
      ).response.status,
    ).toBe(400);
    expect(daemon.service.board.events()).toEqual(events);
    const { result: fresh } = await request<SkillUpdatePreview>(
      `/skills/${skill.id}/update/preview`,
      'POST',
    );
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(fresh.expiresAt) + 1);
    expect(
      (
        await request(`/skills/${skill.id}/update/approve`, 'POST', {
          previewId: fresh.id,
          approved: true,
        })
      ).response.status,
    ).toBe(400);
    clock.mockRestore();
    expect(daemon.service.board.events()).toEqual(events);
    await request(`/skills/${skill.id}`, 'DELETE');
    events = daemon.service.board.events();
    expect(
      (
        await request(`/skills/${skill.id}/update/approve`, 'POST', {
          previewId: fresh.id,
          approved: true,
        })
      ).response.status,
    ).toBe(400);
    expect(daemon.service.board.events()).toEqual(events);
  });

  it('rejects skills without a registry and handles failed or concurrently edited checks', async () => {
    const { daemon, request } = await setup(15084);
    const { source: _source, ...local } = input;
    const { result: custom } = await request<Skill>('/skills', 'POST', local);
    const load = vi
      .spyOn(skillDirectory, 'preview')
      .mockRejectedValue(new Error('Registry unavailable.'));
    expect((await request(`/skills/${custom.id}/update/preview`, 'POST')).response.status).toBe(
      400,
    );
    expect(load).not.toHaveBeenCalled();
    const { result: skill } = await request<Skill>('/skills', 'POST', input);
    let events = daemon.service.board.events();
    expect((await request(`/skills/${skill.id}/update/preview`, 'POST')).response.status).toBe(400);
    expect(daemon.service.board.events()).toEqual(events);
    load.mockImplementationOnce(async () => {
      daemon.service.saveSkill({ ...input, content: 'Concurrent edit.' }, skill.id);
      events = daemon.service.board.events();
      return latest;
    });
    expect((await request(`/skills/${skill.id}/update/preview`, 'POST')).response.status).toBe(400);
    expect(daemon.service.board.events()).toEqual(events);
  });

  it('keeps preview and approval routes behind user sessions and origin checks', async () => {
    const { daemon, request } = await setup(15085);
    const { result: skill } = await request<Skill>('/skills', 'POST', input);
    const load = vi.spyOn(skillDirectory, 'preview').mockResolvedValue(latest);
    const { result: review } = await request<SkillUpdatePreview>(
      `/skills/${skill.id}/update/preview`,
      'POST',
    );
    const events = daemon.service.board.events();
    for (const route of ['preview', 'approve']) {
      const body = { previewId: review.id, approved: true };
      expect(
        (
          await request(`/skills/${skill.id}/update/${route}`, 'POST', body, {
            origin: 'https://example.invalid',
          })
        ).response.status,
      ).toBe(403);
      const response = await fetch(`${daemon.url}/api/skills/${skill.id}/update/${route}`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer fixture-agent-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(403);
    }
    expect(load).toHaveBeenCalledOnce();
    expect(daemon.service.board.events()).toEqual(events);
  });

  it('retains assignment limits and records no rejected approval', async () => {
    const { daemon, request } = await setup(15086);
    const { result: skill } = await request<Skill>('/skills', 'POST', input);
    await request('/skills', 'POST', {
      ...input,
      name: 'Other instructions',
      content: 'x'.repeat(11000),
    });
    vi.spyOn(skillDirectory, 'preview').mockResolvedValue({
      ...latest,
      content: 'x'.repeat(50000),
    });
    const { result: review } = await request<SkillUpdatePreview>(
      `/skills/${skill.id}/update/preview`,
      'POST',
    );
    const events = daemon.service.board.events();
    const { response } = await request(`/skills/${skill.id}/update/approve`, 'POST', {
      previewId: review.id,
      approved: true,
    });
    expect(response.status).toBe(400);
    expect(daemon.service.board.events()).toEqual(events);
    expect(daemon.service.skills().find((item) => item.id === skill.id)).toEqual(skill);
  });
});
