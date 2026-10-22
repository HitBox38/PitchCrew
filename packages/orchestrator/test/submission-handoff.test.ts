import * as packet from '@pitchcrew/packet';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Approval, Card, ChatRequest, Role, Run } from '@pitchcrew/core';
import { cleanup, confirmFixtureApplication, finish, setup } from './helpers/daemon.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
vi.mock('vite', async (importOriginal) => {
  const vite = await importOriginal<typeof import('vite')>();
  return {
    ...vite,
    createServer: (config: import('vite').InlineConfig) =>
      vite.createServer({
        ...config,
        optimizeDeps: { noDiscovery: true, include: [] },
        cacheDir: `/tmp/pitchcrew-inbox-api-cache-${process.pid}`,
      }),
  };
});
afterEach(cleanup);
const prepare = async (port: number) => {
  const host = await setup(port);
  await host.request('/profile', 'PUT', {
    name: 'profile.md',
    content: '# Example Candidate\n\n- Built React interfaces.\n',
  });
  const { result: card } = await host.request<Card>('/cards', 'POST', {
    company: 'Fictional Handoff',
    title: 'React Engineer',
    description: 'Build React interfaces.',
    url: 'https://example.com/application',
  });
  await confirmFixtureApplication(host.request, card.id);
  await host.request(`/cards/${card.id}/move`, 'POST', { state: 'shortlisted' });
  for (const roleId of ['writer', 'reviewer']) {
    const { result: run } = await host.request<Run>(`/cards/${card.id}/run`, 'POST', { roleId });
    await finish(host.request, run.id);
  }
  const { result: approval } = await host.request<Approval>(
    `/cards/${card.id}/approval`,
    'POST',
    {},
  );
  return { ...host, card, approval };
};
describe('user-only post-approval submission handoff', { timeout: 60000 }, () => {
  it('requires approval, exports once, and leaves a manual application unsubmitted', async () => {
    const { request, daemon, approval, card } = await prepare(14676);
    expect(
      (await request(`/approvals/${approval.id}/submit`, 'POST', { method: 'manual' })).response
        .status,
    ).toBe(400);
    await request(`/approvals/${approval.id}/decide`, 'POST', { approved: true });
    const { result, response } = await request<Approval>(
      `/approvals/${approval.id}/submit`,
      'POST',
      { method: 'manual' },
    );
    expect(response.status).toBe(200);
    expect(result).toMatchObject({ status: 'consumed', submission: { method: 'manual' } });
    expect(await readFile(join(result.exportDirectory!, 'resume.md'), 'utf8')).toContain(
      'Built React interfaces.',
    );
    const repeat = await request<Approval>(`/approvals/${approval.id}/submit`, 'POST', {
      method: 'manual',
    });
    expect(repeat.result.exportDirectory).toBe(result.exportDirectory);
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('awaiting_approval');
    expect(daemon.service.board.list<ChatRequest>('chat_request')).toHaveLength(0);
    daemon.service.board.rebuild();
    expect(daemon.service.board.get<Approval>('approval', approval.id).submission?.method).toBe(
      'manual',
    );
    await writeFile(join(result.exportDirectory!, 'resume.md'), 'Changed on disk');
    const changed = await request(`/approvals/${approval.id}/submit`, 'POST', { method: 'manual' });
    expect(changed.response.status).toBe(400);
    expect(daemon.service.board.list<ChatRequest>('chat_request')).toHaveLength(0);
  });
  it('recovers an interrupted export without consuming a second approval', async () => {
    const { request, daemon, approval } = await prepare(14680);
    await request(`/approvals/${approval.id}/decide`, 'POST', { approved: true });
    const write = vi
      .spyOn(packet, 'writePacket')
      .mockRejectedValueOnce(new Error('Fictional disk interruption'));
    expect(
      (await request(`/approvals/${approval.id}/submit`, 'POST', { method: 'manual' })).response
        .status,
    ).toBe(400);
    expect(daemon.service.board.get<Approval>('approval', approval.id)).toMatchObject({
      status: 'consumed',
    });
    write.mockRestore();
    const resumed = await request<Approval>(`/approvals/${approval.id}/submit`, 'POST', {
      method: 'manual',
    });
    expect(resumed.response.status).toBe(200);
    expect(resumed.result.exportDirectory).toContain('try-export-');
    const again = await request<Approval>(`/approvals/${approval.id}/submit`, 'POST', {
      method: 'manual',
    });
    expect(again.result.exportDirectory).toBe(resumed.result.exportDirectory);
  });
  it('checks agent setup before exporting and deduplicates concurrent preparation requests', async () => {
    const { request, daemon, approval, card } = await prepare(14677);
    await request(`/approvals/${approval.id}/decide`, 'POST', { approved: true });
    const role = daemon.service.board.get<Role>('role', 'submitter');
    daemon.service.board.record(
      'role',
      { ...role, enabled: false },
      'user',
      'Pause fixture Submitter',
    );
    expect(
      (
        await request(`/approvals/${approval.id}/submit`, 'POST', {
          method: 'agent',
          roleId: 'submitter',
        })
      ).response.status,
    ).toBe(400);
    expect(daemon.service.board.get<Approval>('approval', approval.id).status).toBe('approved');
    daemon.service.board.record('role', role, 'user', 'Restore fixture Submitter');
    const responses = await Promise.all(
      Array.from({ length: 3 }, () =>
        request<Approval>(`/approvals/${approval.id}/submit`, 'POST', {
          method: 'agent',
          roleId: 'submitter',
        }),
      ),
    );
    expect(responses.map((item) => item.response.status)).toEqual([200, 200, 200]);
    const ids = responses.map((item) => item.result.submission?.requestId);
    expect(new Set(ids).size).toBe(1);
    const saved = daemon.service.board
      .list<ChatRequest>('chat_request')
      .filter((item) => item.submissionApprovalId === approval.id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      threadId: responses[0]!.result.submission?.threadId,
      deliveries: [expect.objectContaining({ roleId: 'submitter' })],
    });
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('awaiting_approval');
    expect(daemon.service.board.list('submission_attempt')).toHaveLength(0);
  });
  it('rejects stale packets and cannot use the handoff to approve itself', async () => {
    const { request, daemon, approval, card } = await prepare(14678);
    await request(`/approvals/${approval.id}/decide`, 'POST', { approved: true });
    const current = daemon.service.board.get<Card>('card', card.id);
    daemon.service.board.record(
      'card',
      { ...current, packet: { ...current.packet!, resume: 'Changed after approval' } },
      'user',
      'Change fixture packet',
    );
    expect(
      (await request(`/approvals/${approval.id}/submit`, 'POST', { method: 'manual' })).response
        .status,
    ).toBe(400);
    expect(daemon.service.board.get<Approval>('approval', approval.id).status).toBe('approved');
    expect(
      (
        await fetch(`${daemon.url}/api/approvals/${approval.id}/submit`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ method: 'manual' }),
        })
      ).status,
    ).toBe(403);
  });
});
