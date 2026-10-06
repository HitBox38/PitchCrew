import { adapters } from '@pitchcrew/adapters';
import type {
  Approval,
  Card,
  Role,
  Run,
  RuntimeModel,
  RuntimeModelCatalog,
  Snapshot,
} from '@pitchcrew/core';
import * as packet from '@pitchcrew/packet';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, finish, setup } from './helpers/daemon.ts';

afterEach(cleanup);
describe('local daemon workflow', () => {
  it('keeps board entities and their events consistent when work changes during profile reads', async () => {
    const { daemon } = await setup(14451);
    const card = daemon.service.board.createCard({
      company: 'Snapshot Fixture',
      title: 'Engineer',
      url: '',
      description: '',
      location: '',
      salary: '',
      tags: [],
    });
    let release!: (files: []) => void;
    const reading = new Promise<[]>((resolve) => {
      release = resolve;
    });
    vi.spyOn(packet, 'readProfile').mockReturnValueOnce(reading);
    const pending = daemon.service.snapshot();
    daemon.service.board.move(card.id, 'shortlisted', 'user');
    daemon.service.addMessage(
      'crew',
      'user',
      'crew',
      'The fixture is now shortlisted.',
      card.id,
      null,
    );
    release([]);
    const snapshot = await pending;
    const event = snapshot.events.find((item) => item.entityId === card.id)!;
    expect(snapshot.cards.find((item) => item.id === card.id)?.state).toBe('shortlisted');
    expect(event.data).toMatchObject({ state: 'shortlisted' });
    expect(snapshot.messages.at(-1)?.content).toBe('The fixture is now shortlisted.');
  });
  it('discovers models on demand, caches and refreshes them without provider calls or board events', async () => {
    vi.spyOn(adapters.opencode, 'detect').mockResolvedValue({
      id: 'opencode',
      available: true,
      version: 'fixture',
      detail: 'Fixture runtime',
    });
    const list = vi
      .spyOn(adapters.opencode, 'listModels')
      .mockResolvedValue([{ value: 'fixture/live-one', label: 'Live One' }]);
    vi.spyOn(adapters['claude-code'], 'detect').mockResolvedValue({
      id: 'claude-code',
      available: true,
      version: 'fixture',
      detail: 'Fixture runtime',
    });
    const claudeList = vi
      .spyOn(adapters['claude-code'], 'listModels')
      .mockResolvedValue([{ value: 'fixture-claude', label: 'Fixture Claude' }]);
    const { daemon, request } = await setup(14434);
    expect(list).not.toHaveBeenCalled();
    expect(claudeList).not.toHaveBeenCalled();
    const eventsBefore = daemon.service.board.events();
    const { result: initial } = await request<RuntimeModelCatalog>(
      '/runtimes/opencode/models',
      'POST',
      {},
    );
    expect(initial).toMatchObject({
      modelSource: 'runtime',
      models: [{ value: 'fixture/live-one', label: 'Live One' }],
    });
    expect(
      (await request<Snapshot>('/snapshot')).result.runtimes.find(
        (runtime) => runtime.id === 'opencode',
      ),
    ).toMatchObject(initial);
    expect(
      (await request<RuntimeModelCatalog>('/runtimes/opencode/models', 'POST', {})).result,
    ).toEqual(initial);
    expect(list).toHaveBeenCalledOnce();
    list.mockResolvedValueOnce([{ value: 'fixture/live-two', label: 'Live Two' }]);
    expect(
      (await request<RuntimeModelCatalog>('/runtimes/opencode/models', 'POST', { refresh: true }))
        .result.models,
    ).toEqual([{ value: 'fixture/live-two', label: 'Live Two' }]);
    expect(list).toHaveBeenCalledTimes(2);
    list.mockRejectedValueOnce(new Error('fixture-private-diagnostic'));
    const { result: fallback } = await request<RuntimeModelCatalog>(
      '/runtimes/opencode/models',
      'POST',
      { refresh: true },
    );
    expect(fallback).toMatchObject({ modelSource: 'fallback', models: adapters.opencode.models });
    expect(JSON.stringify(fallback)).not.toContain('fixture-private-diagnostic');
    expect(
      (await request<RuntimeModelCatalog>('/runtimes/claude-code/models', 'POST', {})).result,
    ).toMatchObject({
      modelSource: 'runtime',
      models: [{ value: 'fixture-claude', label: 'Fixture Claude' }],
    });
    expect(claudeList).toHaveBeenCalledOnce();
    expect(
      (await request<RuntimeModelCatalog>('/runtimes/gemini-cli/models', 'POST', {})).result
        .modelSource,
    ).toBe('fallback');
    expect(
      (await request<RuntimeModelCatalog>('/runtimes/demo/models', 'POST', {})).result,
    ).toMatchObject({ modelSource: 'none', models: [] });
    expect((await request('/runtimes/invalid/models', 'POST', {})).response.status).toBe(400);
    expect(
      (
        await request(
          '/runtimes/opencode/models',
          'POST',
          {},
          { origin: 'https://example.invalid' },
        )
      ).response.status,
    ).toBe(403);
    expect(daemon.service.board.events()).toEqual(eventsBefore);
  });

  it('deduplicates concurrent model discovery and reloads expired catalogs', async () => {
    vi.spyOn(adapters.opencode, 'detect').mockResolvedValue({
      id: 'opencode',
      available: true,
      version: 'fixture',
      detail: 'Fixture runtime',
    });
    let resolveModels!: (models: RuntimeModel[]) => void;
    const list = vi.spyOn(adapters.opencode, 'listModels').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveModels = resolve;
        }),
    );
    const { request } = await setup(14435);
    const first = request<RuntimeModelCatalog>('/runtimes/opencode/models', 'POST', {});
    const second = request<RuntimeModelCatalog>('/runtimes/opencode/models', 'POST', {});
    await vi.waitFor(() => expect(list).toHaveBeenCalledOnce());
    resolveModels([{ value: 'fixture/live', label: 'Live' }]);
    expect((await first).result).toEqual((await second).result);
    expect(list).toHaveBeenCalledOnce();
    list.mockResolvedValueOnce([]);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 5 * 60 * 1000 + 1);
    const { result: expired } = await request<RuntimeModelCatalog>(
      '/runtimes/opencode/models',
      'POST',
      {},
    );
    expect(expired).toMatchObject({ modelSource: 'runtime', models: [] });
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('exposes the new runtimes and persists their role settings through event replay', async () => {
    const { daemon, request } = await setup(14420);
    const { result: snapshot } = await request<Snapshot>('/snapshot');
    expect(snapshot.runtimes.map((runtime) => runtime.id)).toEqual([
      'demo',
      'claude-code',
      'codex',
      'gemini-cli',
      'opencode',
      'copilot-cli',
      'cursor-agent',
      'goose',
      'kiro-cli',
      'grok',
      'pi',
      'oh-my-pi',
    ]);
    for (const runtime of snapshot.runtimes) {
      if (runtime.id === 'demo') {
        expect(runtime.models).toEqual([]);
        continue;
      }
      // Every runtime's public catalog must survive adapter normalization and detection.
      expect(runtime.models.length, runtime.id).toBeGreaterThan(0);
      const values = runtime.models.map((model) => model.value);
      expect(new Set(values).size, runtime.id).toBe(values.length);
      for (const model of runtime.models) {
        expect(model.value.trim(), runtime.id).not.toBe('');
        expect(model.label.trim(), runtime.id).not.toBe('');
        expect(model.value.length, runtime.id).toBeLessThanOrEqual(100);
      }
    }
    // Choices from every catalog round-trip unchanged, including provider/model selectors.
    for (const runtime of snapshot.runtimes.filter((runtime) => runtime.id !== 'demo')) {
      const model = runtime.models[0].value;
      const settings = {
        runtime: runtime.id,
        model,
        enabled: true,
        instructions: 'Fictional role settings.',
      };
      const saved = await request<Role>('/roles/scout', 'PUT', settings);
      expect(saved.response.status, runtime.id).toBe(200);
      expect(saved.result).toMatchObject(settings);
      daemon.service.board.rebuild();
      expect(daemon.service.board.get<Role>('role', 'scout')).toMatchObject(settings);
    }
    for (const [id, runtime, model] of [
      ['scout', 'gemini-cli', 'fixture-model'],
      ['writer', 'opencode', 'example/fixture-model'],
      ['reviewer', 'copilot-cli', 'fixture-model'],
      ['scout', 'cursor-agent', 'fixture-model'],
      ['writer', 'goose', 'openai/fixture-model'],
      ['reviewer', 'kiro-cli', 'fixture-model'],
      ['scout', 'grok', 'fixture-model'],
      ['writer', 'pi', 'example/fixture-model'],
      ['reviewer', 'oh-my-pi', 'example/fixture-model'],
    ] as const) {
      const settings = { runtime, model, enabled: true, instructions: 'Fictional role settings.' };
      const saved = await request<Role>(`/roles/${id}`, 'PUT', settings);
      expect(saved.response.status).toBe(200);
      expect(saved.result).toMatchObject(settings);
      daemon.service.board.rebuild();
      expect(daemon.service.board.get<Role>('role', id)).toMatchObject(settings);
    }
  });
  it('runs a source-backed application through review, approval, export and manual tracking', async () => {
    const { request, directory } = await setup(14417);
    await request('/profile', 'PUT', {
      name: 'profile.md',
      content: '# Example Candidate\n\n- Built React interfaces.\n',
    });
    const { result: card } = await request<Card>('/cards', 'POST', {
      company: 'Fixture Co',
      title: 'React Engineer',
      description: 'Build React interfaces.',
    });
    const { result: scout } = await request<Run>(`/cards/${card.id}/run`, 'POST', {
      roleId: 'scout',
    });
    await finish(request, scout.id);
    await request(`/cards/${card.id}/move`, 'POST', { state: 'shortlisted' });
    const candidates = await Promise.all([
      request<Run>(`/cards/${card.id}/run`, 'POST', { roleId: 'writer' }),
      request<Run>(`/cards/${card.id}/run`, 'POST', { roleId: 'writer' }),
    ]);
    expect(candidates.map((x) => x.response.status).sort()).toEqual([202, 400]);
    const writer = candidates.find((x) => x.response.status === 202)!.result;
    await finish(request, writer.id);
    const { result: reviewer } = await request<Run>(`/cards/${card.id}/run`, 'POST', {
      roleId: 'reviewer',
    });
    const reviewed = await finish(request, reviewer.id);
    expect(reviewed.cards.find((c) => c.id === card.id)?.state).toBe('agreed');
    const { result: approval } = await request<Approval>(`/cards/${card.id}/approval`, 'POST');
    expect((await request(`/approvals/${approval.id}/export`, 'POST')).response.status).toBe(400);
    expect(
      (await request(`/cards/${card.id}/move`, 'POST', { state: 'submitted' })).response.status,
    ).toBe(400);
    await request(`/approvals/${approval.id}/decide`, 'POST', { approved: true });
    const exported = await request<{ directory: string }>(
      `/approvals/${approval.id}/export`,
      'POST',
    );
    expect(exported.response.status).toBe(200);
    expect(exported.result.directory.startsWith(directory)).toBe(true);
    expect(await readFile(join(exported.result.directory, 'resume.md'), 'utf8')).toContain(
      'Built React interfaces.',
    );
    expect((await request(`/approvals/${approval.id}/export`, 'POST')).response.status).toBe(400);
    await request(`/cards/${card.id}/move`, 'POST', { state: 'changes_requested' });
    await request('/profile', 'PUT', {
      name: 'profile.md',
      content:
        '# Example Candidate\n\n- Built React interfaces.\n- Shipped accessible scheduling tools.\n',
    });
    const { result: revised } = await request<Run>(`/cards/${card.id}/run`, 'POST', {
      roleId: 'writer',
    });
    await finish(request, revised.id);
    const { result: reviewedAgain } = await request<Run>(`/cards/${card.id}/run`, 'POST', {
      roleId: 'reviewer',
    });
    await finish(request, reviewedAgain.id);
    const { result: freshApproval } = await request<Approval>(`/cards/${card.id}/approval`, 'POST');
    expect(
      (await request(`/cards/${card.id}/move`, 'POST', { state: 'submitted' })).response.status,
    ).toBe(400);
    await request(`/approvals/${freshApproval.id}/decide`, 'POST', { approved: true });
    expect((await request(`/approvals/${freshApproval.id}/export`, 'POST')).response.status).toBe(
      200,
    );
    await request(`/cards/${card.id}/move`, 'POST', { state: 'submitted' });
    await request(`/cards/${card.id}/move`, 'POST', { state: 'interviewing' });
    const { result: final } = await request<Snapshot>('/snapshot');
    expect(final.cards[0].state).toBe('interviewing');
  });
  it('rejects cross-origin/user-session bypasses and expired agent capabilities', async () => {
    const { daemon, request } = await setup(14418);
    expect((await fetch(`${daemon.url}/api/snapshot`)).status).toBe(403);
    expect(
      (
        await request(
          '/cards',
          'POST',
          { company: 'bad', title: 'bad' },
          { origin: 'https://evil.example' },
        )
      ).response.status,
    ).toBe(403);
    expect(
      (await request('/agent', 'POST', { action: 'profile' }, { authorization: 'Bearer missing' }))
        .response.status,
    ).toBe(403);
  });
  it('keeps role permissions and cancellation scoped to an active run', async () => {
    const { daemon, request } = await setup(14419);
    await request('/profile', 'PUT', {
      name: 'profile.md',
      content: '# Candidate\n\n- Built React interfaces.',
    });
    const { result: card } = await request<Card>('/cards', 'POST', {
      company: 'Fixture',
      title: 'Engineer',
    });
    const { result: run } = await request<Run>(`/cards/${card.id}/run`, 'POST', {
      roleId: 'scout',
    });
    const token = [...daemon.service.capabilities.keys()][0];
    expect((await daemon.service.agentCall(token, 'card', {})).card).toEqual(
      daemon.service.board.get('card', card.id),
    );
    await expect(daemon.service.agentCall(token, 'approve', {})).rejects.toThrow('not allowed');
    await request(`/runs/${run.id}/cancel`, 'POST');
    for (let i = 0; i < 50 && daemon.service.controllers.size; i++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(daemon.service.agentCall(token, 'profile', {})).rejects.toThrow('expired');
    expect(daemon.service.board.get<Run>('run', run.id).status).toBe('cancelled');
  });
});
