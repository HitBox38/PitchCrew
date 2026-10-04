import { currentEventVersion } from '@pitchcrew/core';
import { adapters } from '@pitchcrew/adapters';
import type { Run, Skill, Snapshot } from '@pitchcrew/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, finish, setup } from './helpers/daemon.ts';

afterEach(cleanup);
describe('managed agent skills', () => {
  const sharedInput = {
    name: 'Clear writing',
    description: 'Use when explaining a job.',
    content: 'Use concise sentences backed by profile evidence.',
    scope: 'all',
    roleIds: [],
  };
  it('creates, updates and deletes skills with replayable events and user-only access', async () => {
    const { daemon, request } = await setup(14436);
    expect((await request<Snapshot>('/snapshot')).result.skills).toEqual([]);
    const { response, result: shared } = await request<Skill>('/skills', 'POST', sharedInput);
    expect(response.status).toBe(201);
    const { result: individual } = await request<Skill>('/skills', 'POST', {
      ...sharedInput,
      name: 'Review checklist',
      scope: 'roles',
      roleIds: ['reviewer'],
    });
    const { result: updated } = await request<Skill>(`/skills/${individual.id}`, 'PUT', {
      ...sharedInput,
      name: 'Updated checklist',
      scope: 'roles',
      roleIds: ['writer', 'reviewer'],
    });
    expect(updated).toMatchObject({
      id: individual.id,
      createdAt: individual.createdAt,
      roleIds: ['writer', 'reviewer'],
    });
    expect(daemon.service.skills('scout').map((skill) => skill.id)).toEqual([shared.id]);
    expect(daemon.service.skills('writer').map((skill) => skill.id)).toEqual([
      shared.id,
      individual.id,
    ]);
    expect((await request(`/skills/${shared.id}`, 'DELETE')).response.status).toBe(200);
    expect((await request<Snapshot>('/snapshot')).result.skills).toEqual([updated]);
    const events = daemon.service.board.events();
    expect(events.filter((event) => event.kind === 'skill')).toHaveLength(4);
    expect(
      events
        .filter((event) => event.kind === 'skill')
        .every((event) => event.version === currentEventVersion && event.actor === 'user'),
    ).toBe(true);
    daemon.service.board.rebuild();
    await daemon.service.initialize(false);
    expect((await request<Snapshot>('/snapshot')).result.skills).toEqual([updated]);
    expect(daemon.service.board.events()).toEqual(events);
    expect(daemon.service.board.get<Skill>('skill', shared.id).deletedAt).not.toBeNull();
    expect((await request(`/skills/${shared.id}`, 'PUT', sharedInput)).response.status).toBe(400);
    expect(
      (await request('/skills', 'POST', { ...sharedInput, scope: 'roles', roleIds: [] })).response
        .status,
    ).toBe(400);
    expect(
      (await request('/skills', 'POST', { ...sharedInput, roleIds: ['scout'] })).response.status,
    ).toBe(400);
    expect(
      (
        await request('/skills', 'POST', {
          ...sharedInput,
          scope: 'roles',
          roleIds: ['scout', 'scout'],
        })
      ).response.status,
    ).toBe(400);
    expect(
      (await request('/skills', 'POST', { ...sharedInput, content: '  ' })).response.status,
    ).toBe(400);
    expect(
      (await request('/skills', 'POST', { ...sharedInput, scope: 'roles', roleIds: ['unknown'] }))
        .response.status,
    ).toBe(400);
    expect(
      (await request('/skills', 'POST', sharedInput, { origin: 'https://example.invalid' }))
        .response.status,
    ).toBe(403);
    const unauthenticated = await fetch(`${daemon.url}/api/skills`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer fixture-agent-token' },
      body: JSON.stringify(sharedInput),
    });
    expect(unauthenticated.status).toBe(403);
    expect(daemon.service.board.events()).toEqual(events);
  });
  it('passes only assigned skills to chat and workflow runtimes and writes isolated Markdown copies', async () => {
    const { daemon, directory, request } = await setup(14437);
    const { result: shared } = await request<Skill>('/skills', 'POST', sharedInput);
    const { result: writerSkill } = await request<Skill>('/skills', 'POST', {
      ...sharedInput,
      name: 'Writer method',
      scope: 'roles',
      roleIds: ['writer'],
    });
    const chat = vi.spyOn(adapters.demo, 'chat');
    for (const roleId of ['scout', 'writer', 'reviewer'] as const) {
      const { result: run } = await request<Run>(`/roles/${roleId}/chat`, 'POST', {
        content: 'Use the assigned skills.',
      });
      await finish(request, run.id);
      const context = chat.mock.calls.at(-1)![0];
      expect(context.skills).toEqual(roleId === 'writer' ? [shared, writerSkill] : [shared]);
      const folder = join(directory, 'roles', roleId, 'runs', run.id);
      const instructions = await readFile(join(folder, 'AGENTS.md'), 'utf8');
      expect(instructions).toContain(shared.content);
      expect(instructions.includes(writerSkill.name)).toBe(roleId === 'writer');
      expect(await readFile(join(folder, 'skills', shared.id, 'SKILL.md'), 'utf8')).toContain(
        shared.name,
      );
      if (roleId !== 'writer')
        await expect(
          readFile(join(folder, 'skills', writerSkill.id, 'SKILL.md')),
        ).rejects.toThrow();
    }
    await daemon.service.saveProfile(
      'profile.md',
      '# Fictional profile\n\nI built fictional software.',
    );
    const card = daemon.service.createCard({ company: 'Fictional Co', title: 'Engineer' });
    const workflow = vi.spyOn(adapters.demo, 'run');
    const run = await daemon.service.startRun(card.id, 'scout');
    await finish(request, run.id);
    expect(workflow.mock.calls.at(-1)![0].skills).toEqual([shared]);
    expect(
      await readFile(join(directory, 'roles', 'scout', 'runs', run.id, 'AGENTS.md'), 'utf8'),
    ).toContain(shared.content);
  });
  it('keeps active skill snapshots intact while edits and deletion affect subsequent runs', async () => {
    const { directory, request } = await setup(14438);
    const { result: skill } = await request<Skill>('/skills', 'POST', sharedInput);
    let complete!: (result: { reply: string }) => void;
    const chat = vi.spyOn(adapters.demo, 'chat').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const { result: active } = await request<Run>('/roles/scout/chat', 'POST', {
      content: 'Use the skill.',
    });
    await vi.waitFor(() => expect(chat).toHaveBeenCalledOnce());
    await request(`/skills/${skill.id}`, 'PUT', {
      ...sharedInput,
      content: 'Updated instructions for future runs.',
    });
    expect(chat.mock.calls[0][0].skills).toEqual([skill]);
    complete({ reply: 'Fixture completed.' });
    await finish(request, active.id);
    const firstInstructions = await readFile(
      join(directory, 'roles', 'scout', 'runs', active.id, 'AGENTS.md'),
      'utf8',
    );
    expect(firstInstructions).toContain(sharedInput.content);
    expect(firstInstructions).not.toContain('Updated instructions');
    const { result: next } = await request<Run>('/roles/scout/chat', 'POST', {
      content: 'Use the update.',
    });
    await finish(request, next.id);
    expect(chat.mock.calls[1][0].skills?.[0].content).toBe('Updated instructions for future runs.');
    await request(`/skills/${skill.id}`, 'DELETE');
    const { result: last } = await request<Run>('/roles/scout/chat', 'POST', {
      content: 'No more skill.',
    });
    await finish(request, last.id);
    expect(chat.mock.calls[2][0].skills).toEqual([]);
    expect(
      await readFile(join(directory, 'roles', 'scout', 'runs', active.id, 'AGENTS.md'), 'utf8'),
    ).toBe(firstInstructions);
  });
  it('bounds the total assigned instructions without appending rejected updates', async () => {
    const { daemon, request } = await setup(14439);
    for (let index = 0; index < 4; index++)
      expect(
        (
          await request('/skills', 'POST', {
            ...sharedInput,
            name: `Skill ${index}`,
            content: 'a'.repeat(12000),
          })
        ).response.status,
      ).toBe(201);
    const events = daemon.service.board.events();
    expect(
      (await request('/skills', 'POST', { ...sharedInput, content: 'a'.repeat(12000) })).response
        .status,
    ).toBe(400);
    expect(daemon.service.board.events()).toEqual(events);
  });
  it('stores and replays larger writing skills while retaining individual and role limits', async () => {
    const { daemon, request } = await setup(14445);
    const { result: skill, response } = await request<Skill>('/skills', 'POST', {
      ...sharedInput,
      content: 'a'.repeat(50000),
    });
    expect(response.status).toBe(201);
    daemon.service.board.rebuild();
    expect(daemon.service.skills()[0].content).toBe(skill.content);
    const events = daemon.service.board.events();
    expect(
      (await request('/skills', 'POST', { ...sharedInput, content: 'a'.repeat(50001) })).response
        .status,
    ).toBe(400);
    expect(
      (await request('/skills', 'POST', { ...sharedInput, content: 'a'.repeat(10000) })).response
        .status,
    ).toBe(400);
    expect(daemon.service.board.events()).toEqual(events);
  });
});
