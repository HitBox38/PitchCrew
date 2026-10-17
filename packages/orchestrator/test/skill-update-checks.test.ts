import {
  isPendingSkillUpdate,
  skillSourceRevision,
  skillUpdateCheckInterval,
  type Skill,
  type SkillUpdatesState,
  type Snapshot,
} from '@pitchcrew/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDaemon } from '../src/server.ts';
import { skillDirectory } from '../src/skills-directory.ts';
import { cleanup, directorySkill, resources, setup } from './helpers/daemon.ts';

afterEach(cleanup);
const input = { ...directorySkill, scope: 'all', roleIds: [] };
const latest = {
  ...directorySkill,
  content: 'Fictional new upstream instructions.',
  source: { ...directorySkill.source!, blobSha: 'b'.repeat(40) },
};

describe('persistent user-only skill update checks', () => {
  it('checks every imported skill daily, ignores local-only edits, and respects the automatic switch', async () => {
    const { daemon, request } = await setup(15731);
    const skill = daemon.service.saveSkill({ ...input, content: 'My local instructions.' });
    const load = vi.spyOn(skillDirectory, 'preview').mockResolvedValue(directorySkill);
    const events = daemon.service.board.events();
    const check = () =>
      request<SkillUpdatesState>('/skills/updates/check', 'POST', { automatic: true });
    expect((await check()).result.checks.filter(isPendingSkillUpdate)).toEqual([]);
    expect(load).toHaveBeenCalledOnce();
    await check();
    expect(load).toHaveBeenCalledOnce();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + skillUpdateCheckInterval + 1);
    load.mockResolvedValue(latest);
    expect(
      (await check()).result.checks.filter(isPendingSkillUpdate).map((item) => item.skillId),
    ).toEqual([skill.id]);
    expect(load).toHaveBeenCalledTimes(2);
    await request('/skills/updates/preferences', 'PUT', { automatic: false });
    await check();
    expect(load).toHaveBeenCalledTimes(2);
    await request('/skills/updates/check', 'POST');
    expect(load).toHaveBeenCalledTimes(3);
    expect(daemon.service.board.events()).toEqual(events);
    expect(daemon.service.skills()[0].content).toBe('My local instructions.');
  });

  it('persists decisions across restarts, reopens on a different version, and updates snapshot validators', async () => {
    const { daemon, directory, request } = await setup(15732);
    const skill = daemon.service.saveSkill(input);
    const load = vi.spyOn(skillDirectory, 'preview').mockResolvedValue(latest);
    const before = await daemon.service.snapshotRevision();
    await request('/skills/updates/check', 'POST');
    expect(await daemon.service.snapshotRevision()).not.toBe(before);
    const checked = await daemon.service.snapshotRevision();
    const decision = await request<SkillUpdatesState>(
      `/skills/${skill.id}/update/dismiss`,
      'POST',
      { revision: skillSourceRevision(latest.source) },
    );
    expect(decision.response.status).toBe(200);
    expect(decision.result.checks.filter(isPendingSkillUpdate)).toEqual([]);
    expect(await daemon.service.snapshotRevision()).not.toBe(checked);
    await request('/skills/updates/check', 'POST');
    expect(
      (await daemon.service.snapshot()).skillUpdates!.checks.filter(isPendingSkillUpdate),
    ).toEqual([]);
    await request('/skills/updates/preferences', 'PUT', { automatic: false });
    for (const entry of resources.splice(0)) await entry.daemon.close();
    const restarted = await createDaemon({ directory, port: 15732, seedSkills: false, dev: true });
    resources.push({ daemon: restarted, directory });
    const state = (await restarted.service.snapshot()).skillUpdates!;
    expect(state.automatic).toBe(false);
    expect(state.checks[0].dismissedRevision).toBe(skillSourceRevision(latest.source));
    const newer = { ...latest, source: { ...latest.source, blobSha: 'c'.repeat(40) } };
    load.mockResolvedValue(newer);
    expect(
      (await restarted.service.checkSkillUpdates(false)).checks.filter(isPendingSkillUpdate),
    ).toHaveLength(1);
    expect(() =>
      restarted.service.dismissSkillUpdate(skill.id, skillSourceRevision(latest.source)),
    ).toThrow('changed');
    const persisted = await readFile(join(directory, 'skill-updates.json'), 'utf8');
    expect(persisted).not.toContain(latest.content);
  });

  it('keeps known updates and success times when offline, then clears failures on recovery', async () => {
    const { daemon } = await setup(15733);
    daemon.service.saveSkill(input);
    const load = vi.spyOn(skillDirectory, 'preview').mockResolvedValue(latest);
    const original = await daemon.service.checkSkillUpdates(false);
    load.mockRejectedValue(new Error('Fictional network failure'));
    const failed = await daemon.service.checkSkillUpdates(false);
    expect(failed.checks.filter(isPendingSkillUpdate)).toHaveLength(1);
    expect(failed.checks[0]).toMatchObject({
      latest: latest.source,
      successfulAt: original.checks[0].successfulAt,
      error: expect.stringContaining('Couldn’t check'),
    });
    load.mockResolvedValue(latest);
    expect((await daemon.service.checkSkillUpdates(false)).checks[0].error).toBeUndefined();
  });

  it('deduplicates concurrent clients and drops stale results after edits or deletion', async () => {
    const { daemon } = await setup(15734);
    const skill = daemon.service.saveSkill(input);
    let resolve!: (value: typeof latest) => void;
    const load = vi.spyOn(skillDirectory, 'preview').mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const first = daemon.service.checkSkillUpdates(false);
    const second = daemon.service.checkSkillUpdates(false);
    daemon.service.saveSkill({ ...input, content: 'Concurrent local edit.' }, skill.id);
    resolve(latest);
    expect((await first).checks).toEqual([]);
    expect((await second).checks).toEqual([]);
    expect(load).toHaveBeenCalledOnce();
    load.mockResolvedValue(latest);
    expect((await daemon.service.checkSkillUpdates(false)).checks).toHaveLength(1);
    daemon.service.deleteSkill(skill.id);
    expect((await daemon.service.snapshot()).skillUpdates!.checks).toEqual([]);
  });

  it('removes an applied update through the existing exact-preview approval', async () => {
    const { daemon, request } = await setup(15735);
    const skill = daemon.service.saveSkill(input);
    vi.spyOn(skillDirectory, 'preview').mockResolvedValue(latest);
    await daemon.service.checkSkillUpdates(false);
    const preview = await daemon.service.previewSkillUpdate(skill.id);
    const result = await request<Skill>(`/skills/${skill.id}/update/approve`, 'POST', {
      previewId: preview.id,
      approved: true,
    });
    expect(result.response.status).toBe(200);
    expect(result.result.content).toBe(latest.content);
    expect(
      (await request<Snapshot>('/snapshot')).result.skillUpdates!.checks.filter(
        isPendingSkillUpdate,
      ),
    ).toEqual([]);
  });

  it('rejects unauthenticated and cross-origin checks, preferences and decisions without network calls', async () => {
    const { daemon, request } = await setup(15736);
    const skill = daemon.service.saveSkill(input);
    const load = vi.spyOn(skillDirectory, 'preview').mockResolvedValue(latest);
    for (const [path, method, body] of [
      ['/skills/updates/check', 'POST', {}],
      ['/skills/updates/preferences', 'PUT', { automatic: false }],
      [`/skills/${skill.id}/update/dismiss`, 'POST', { revision: 'fictional' }],
    ] as const) {
      expect(
        (await request(path, method, body, { origin: 'https://example.invalid' })).response.status,
      ).toBe(403);
      expect(
        (
          await fetch(`${daemon.url}/api${path}`, {
            method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
        ).status,
      ).toBe(403);
    }
    expect(load).not.toHaveBeenCalled();
  });
});
