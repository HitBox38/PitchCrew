import { currentEventVersion } from '@pitchcrew/core';
import { adapters } from '@pitchcrew/adapters';
import type { Skill, SkillPreview, SkillProposal, Snapshot } from '@pitchcrew/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { skillDirectory } from '../src/skills-directory.ts';
import { cleanup, directorySkill, setup, waitForSnapshot } from './helpers/daemon.ts';

afterEach(cleanup);
describe('directory imports and skill suggestions', () => {
  it('previews sources without installing, preserves provenance and refreshes imported skill content', async () => {
    const { daemon, request } = await setup(14440);
    const preview = vi.spyOn(skillDirectory, 'preview').mockResolvedValue(directorySkill);
    const events = daemon.service.board.events();
    const { result: loaded, response } = await request<SkillPreview>('/skills/preview', 'POST', {
      url: directorySkill.source!.url,
    });
    expect(response.status).toBe(200);
    expect(loaded).toEqual(directorySkill);
    expect((await request<Snapshot>('/snapshot')).result.skills).toEqual([]);
    expect(daemon.service.board.events()).toEqual(events);
    const { result: installed } = await request<Skill>('/skills', 'POST', {
      ...loaded,
      scope: 'roles',
      roleIds: ['writer'],
    });
    expect(installed.source).toEqual(directorySkill.source);
    const changed = {
      ...directorySkill,
      content: 'Changed upstream instructions.',
      source: { ...directorySkill.source!, blobSha: 'b'.repeat(40) },
    };
    preview.mockResolvedValue(changed);
    const { result: refreshed } = await request<SkillPreview>('/skills/preview', 'POST', {
      url: directorySkill.source!.url,
    });
    expect(daemon.service.skills()[0].content).toBe(directorySkill.content);
    await request(`/skills/${installed.id}`, 'PUT', {
      ...refreshed,
      scope: 'roles',
      roleIds: ['writer'],
    });
    expect(daemon.service.skills()[0]).toMatchObject({
      content: changed.content,
      source: changed.source,
    });
    await request(`/skills/${installed.id}`, 'PUT', {
      name: installed.name,
      description: installed.description,
      content: 'Locally edited instructions.',
      scope: 'roles',
      roleIds: ['writer'],
    });
    expect(daemon.service.skills()[0].source).toEqual(changed.source);
    const count = preview.mock.calls.length;
    expect(
      (await request('/skills/preview', 'POST', { url: 'http://127.0.0.1/private' })).response
        .status,
    ).toBe(400);
    expect(preview).toHaveBeenCalledTimes(count);
    expect(
      (
        await request(
          '/skills/preview',
          'POST',
          { url: directorySkill.source!.url },
          { origin: 'https://example.invalid' },
        )
      ).response.status,
    ).toBe(403);
  });
  it('persists suggestions in private and agent-to-agent chats and adds only the exact user-approved snapshot', async () => {
    const { daemon, request } = await setup(14441);
    const preview = vi.spyOn(skillDirectory, 'preview').mockResolvedValue(directorySkill);
    vi.spyOn(adapters.demo, 'chat').mockImplementation(async (context) => {
      const token = context.mcp.env.PITCHCREW_RUN_TOKEN;
      if (context.role.id === 'scout') {
        await daemon.service.agentCall(token, 'propose_skill', {
          reason: 'Keep shared explanations concise.',
          suggestion: {
            kind: 'custom',
            skill: {
              name: 'Clear explanations',
              description: '',
              content: 'Use short sentences.',
              scope: 'all',
              roleIds: [],
            },
          },
        });
        await daemon.service.agentCall(token, 'message', {
          roleId: 'writer',
          content: 'Would a profile evidence skill help our application work?',
        });
      } else if (context.role.id === 'writer') {
        await daemon.service.agentCall(token, 'propose_skill', {
          reason: 'Our crew discussion identified a useful evidence checklist.',
          suggestion: {
            kind: 'skills-sh',
            url: directorySkill.source!.url,
            assignment: { scope: 'roles', roleIds: ['writer', 'reviewer'] },
          },
        });
      }
      return { reply: 'I suggested a skill for the user to review.' };
    });
    await request('/roles/scout/chat', 'POST', {
      content: 'Suggest skills and discuss them with Writer.',
    });
    const before = await waitForSnapshot(
      request,
      (snapshot) =>
        snapshot.skillProposals.length === 2 &&
        snapshot.runs.every((run) => run.status !== 'running'),
    );
    expect(before.skills).toEqual([]);
    const custom = before.skillProposals.find((proposal) => proposal.roleId === 'scout')!;
    const imported = before.skillProposals.find((proposal) => proposal.roleId === 'writer')!;
    expect(custom).toMatchObject({ threadId: 'scout', status: 'pending' });
    const dm = before.conversations!.find((item) => item.kind === 'agent_dm')!;
    expect(imported).toMatchObject({
      threadId: dm.id,
      status: 'pending',
      skill: { ...directorySkill, scope: 'roles', roleIds: ['writer', 'reviewer'] },
    });
    expect(before.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          threadId: 'scout',
          from: 'scout',
          content: expect.stringContaining('Clear explanations'),
        }),
        expect.objectContaining({
          threadId: dm.id,
          from: 'writer',
          content: expect.stringContaining('evidence-checklist'),
        }),
      ]),
    );
    preview.mockResolvedValue({ ...directorySkill, content: 'Unreviewed upstream change.' });
    const { result: applied } = await request<SkillProposal>(
      `/skill-proposals/${imported.id}/decide`,
      'POST',
      { approved: true },
    );
    expect(applied).toMatchObject({ status: 'applied', skillId: expect.any(String) });
    expect(preview).toHaveBeenCalledOnce();
    expect(daemon.service.skills()).toHaveLength(1);
    expect(daemon.service.skills()[0]).toMatchObject({
      ...directorySkill,
      scope: 'roles',
      roleIds: ['writer', 'reviewer'],
    });
    expect(daemon.service.skills('scout')).toEqual([]);
    const events = daemon.service.board.events();
    expect(
      (await request(`/skill-proposals/${imported.id}/decide`, 'POST', { approved: true })).response
        .status,
    ).toBe(400);
    expect(daemon.service.board.events()).toEqual(events);
    expect(
      (await request(`/skill-proposals/${custom.id}/decide`, 'POST', { approved: false })).response
        .status,
    ).toBe(200);
    daemon.service.board.rebuild();
    const after = (await request<Snapshot>('/snapshot')).result;
    expect(after.skillProposals.map((proposal) => proposal.status)).toEqual([
      'rejected',
      'applied',
    ]);
    expect(after.skills).toHaveLength(1);
    expect(
      after.events
        .filter((event) => event.kind === 'skill_proposal')
        .every((event) => event.version === currentEventVersion),
    ).toBe(true);
    const unauthenticated = await fetch(`${daemon.url}/api/skill-proposals/${custom.id}/decide`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer fixture-run-token' },
      body: JSON.stringify({ approved: true }),
    });
    expect(unauthenticated.status).toBe(403);
  });
  it('bounds suggestions and rejects late remote results from cancelled capabilities', async () => {
    const { daemon, request } = await setup(14442);
    const controller = new AbortController();
    const token = 'fixture-skill-suggestion-token';
    const runId = 'fixture-skill-suggestion-run';
    daemon.service.board.record(
      'run',
      {
        id: runId,
        cardId: null,
        roleId: 'scout',
        runtime: 'demo',
        status: 'running',
        mode: 'chat',
        threadId: 'crew',
        message: 'Fixture suggestion',
        startedAt: '',
        finishedAt: null,
      },
      'scout',
      'Fixture suggestion run',
    );
    daemon.service.controllers.set(runId, controller);
    daemon.service.capabilities.set(token, { runId, cardId: null, roleId: 'scout' });
    try {
      const suggestion = {
        kind: 'custom',
        skill: {
          name: 'Fictional method',
          content: 'Use exact quotations.',
          scope: 'all',
          roleIds: [],
        },
      };
      for (let i = 0; i < 3; i++)
        expect(
          (
            await request(
              '/agent',
              'POST',
              { action: 'propose_skill', reason: 'Fixture reason', suggestion },
              { authorization: `Bearer ${token}` },
            )
          ).response.status,
        ).toBe(200);
      const events = daemon.service.board.events();
      expect(
        (
          await request(
            '/agent',
            'POST',
            { action: 'propose_skill', reason: 'One too many', suggestion },
            { authorization: `Bearer ${token}` },
          )
        ).response.status,
      ).toBe(400);
      expect(daemon.service.board.events()).toEqual(events);
      expect(daemon.service.skills()).toEqual([]);
      expect(
        (
          await request(
            '/agent',
            'POST',
            { action: 'add_skill', suggestion },
            { authorization: `Bearer ${token}` },
          )
        ).response.status,
      ).toBe(400);
      // Use a fresh run to exercise cancellation while an import is in flight.
      const freshId = 'fixture-late-suggestion-run';
      daemon.service.board.record(
        'run',
        {
          id: freshId,
          cardId: null,
          roleId: 'scout',
          runtime: 'demo',
          status: 'running',
          mode: 'chat',
          threadId: 'scout',
          message: 'Fixture',
          startedAt: '',
          finishedAt: null,
        },
        'scout',
        'Fixture late run',
      );
      daemon.service.capabilities.set(token, { runId: freshId, cardId: null, roleId: 'scout' });
      daemon.service.controllers.set(freshId, controller);
      let resolvePreview!: (preview: SkillPreview) => void;
      const preview = vi.spyOn(skillDirectory, 'preview').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePreview = resolve;
          }),
      );
      const pending = daemon.service.agentCall(token, 'propose_skill', {
        reason: 'Fixture remote suggestion',
        suggestion: {
          kind: 'skills-sh',
          url: directorySkill.source!.url,
          assignment: { scope: 'all', roleIds: [] },
        },
      });
      await vi.waitFor(() => expect(preview).toHaveBeenCalledOnce());
      controller.abort();
      const settled = expect(pending).rejects.toThrow('expired');
      resolvePreview(directorySkill);
      await settled;
      expect((await daemon.service.snapshot()).skillProposals).toHaveLength(3);
      daemon.service.controllers.delete(freshId);
    } finally {
      daemon.service.controllers.clear();
      daemon.service.capabilities.clear();
    }
  });
});
