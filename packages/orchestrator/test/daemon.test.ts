import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDaemon } from '../src/server.ts';
import type { Approval, Card, Role, Run, Snapshot } from '@pitchcrew/core';
const resources: { daemon: Awaited<ReturnType<typeof createDaemon>>; directory: string }[] = [];
async function setup(port: number) {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-test-'));
  const daemon = await createDaemon({ directory, port });
  resources.push({ daemon, directory });
  await new Promise<void>((resolve) => daemon.http.listen(port, '127.0.0.1', resolve));
  const response = await fetch(daemon.url);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    extra: Record<string, string> = {},
  ) {
    const response = await fetch(`${daemon.url}/api${path}`, {
      method,
      headers: { cookie, 'x-pitchcrew-client': 'ui', 'content-type': 'application/json', ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = (await response.json()) as T;
    return { response, result };
  }
  return { daemon, directory, request };
}
afterEach(async () => {
  for (const { daemon, directory } of resources.splice(0)) {
    await daemon.close();
    const prefix = resolve(tmpdir(), 'pitchcrew-test-');
    if (!resolve(directory).startsWith(prefix)) throw new Error('Refusing unsafe cleanup target.');
    await rm(directory, { recursive: true, force: true });
  }
});
async function finish(request: <T>(path: string) => Promise<{ result: T }>, id: string) {
  for (let i = 0; i < 80; i++) {
    const { result } = await request<Snapshot>('/snapshot');
    const run = result.runs.find((run) => run.id === id);
    if (run && run.status !== 'running') {
      expect(run.status, run.message).toBe('completed');
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('Run did not finish.');
}
describe('local daemon workflow', () => {
  it('exposes the new runtimes and persists their role settings through event replay', async () => {
    const { daemon, request } = await setup(14420);
    const { result: snapshot } = await request<Snapshot>('/snapshot');
    expect(snapshot.runtimes.map((runtime) => runtime.id)).toEqual([
      'demo',
      'claude-code',
      'codex',
      'gemini-cli',
      'opencode',
    ]);
    for (const [id, runtime, model] of [
      ['scout', 'gemini-cli', 'fixture-model'],
      ['writer', 'opencode', 'example/fixture-model'],
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
