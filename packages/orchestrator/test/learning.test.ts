import { currentEventVersion } from '@pitchcrew/core';
import { defaultCapabilities, type Card, type Role, type StaleSubmission } from '@pitchcrew/core';
import { afterEach, describe, expect, it } from 'vitest';
import { insightsByteLimit } from '../src/crew/gateway/insights.ts';
import { cleanup, resources, setup } from './helpers/daemon.ts';

const day = 24 * 60 * 60 * 1000;
afterEach(async () => {
  for (const { daemon } of resources) {
    daemon.service.controllers.delete('insights-fixture');
    daemon.service.capabilities.delete('insights-token');
  }
  await cleanup();
});
async function fixture(port: number) {
  const context = await setup(port);
  const { daemon } = context;
  const permit = (capabilities: Partial<typeof defaultCapabilities>) => {
    const role = daemon.service.board.get<Role>('role', 'scout');
    daemon.service.board.record(
      'role',
      { ...role, capabilities: { ...defaultCapabilities, ...capabilities } },
      'user',
      'Fixture capability change',
    );
  };
  daemon.service.capabilities.set('insights-token', {
    roleId: 'scout',
    cardId: null,
    runId: 'insights-fixture',
  });
  daemon.service.controllers.set('insights-fixture', new AbortController());
  const agent = async <T>(action: string, data: Record<string, unknown> = {}) => {
    const response = await fetch(`${daemon.url}/api/agent`, {
      method: 'POST',
      headers: { authorization: 'Bearer insights-token', 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
    return { response, result: (await response.json()) as T & { error?: string } };
  };
  return { ...context, permit, agent };
}

describe('learning signals over HTTP', () => {
  it('keeps weights, lessons, tag merges and stale cleanup behind the user session', async () => {
    const { request, daemon, agent } = await fixture(15441);
    const card = (
      await request<Card>('/cards', 'POST', {
        company: 'Juniper Analytics',
        title: 'Platform Engineer',
        tags: ['ReactJS', 'Remote'],
      })
    ).result;
    for (const [path, method, body] of [
      [`/cards/${card.id}/weight`, 'PUT', { weight: 2 }],
      [`/cards/${card.id}/lessons`, 'POST', { text: 'Fictional lesson' }],
      ['/tags/merge', 'POST', { from: 'ReactJS', to: 'React' }],
      ['/insights/stale?days=21', 'GET', undefined],
    ] as const) {
      const response = await fetch(`${daemon.url}/api${path}`, {
        method,
        headers: { authorization: 'Bearer insights-token', 'content-type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      expect(response.status).toBe(403);
    }
    for (const action of ['weight', 'lesson', 'merge_tags', 'mark_stale', 'ghost_stale'])
      expect((await agent(action)).result.error).toBe('This tool is not allowed.');
    expect(daemon.service.board.get<Card>('card', card.id).weight).toBeUndefined();

    const weighted = await request<Card>(`/cards/${card.id}/weight`, 'PUT', { weight: -2 });
    expect(weighted.result.weight).toBe(-2);
    expect((await request(`/cards/${card.id}/weight`, 'PUT', { weight: 5 })).response.status).toBe(
      400,
    );
    const lesson = await request<Card>(`/cards/${card.id}/lessons`, 'POST', {
      text: 'Ask about the on-call rotation early.',
    });
    expect(lesson.response.status).toBe(201);
    const lessonId = lesson.result.lessons![0].id;
    expect((await request(`/cards/${card.id}/lessons/not-a-uuid`, 'DELETE')).response.status).toBe(
      400,
    );
    const removed = await request<Card>(`/cards/${card.id}/lessons/${lessonId}`, 'DELETE');
    expect(removed.result.lessons).toEqual([]);
    const merged = await request<{ cards: Card[] }>('/tags/merge', 'POST', {
      from: 'reactjs',
      to: 'React',
    });
    expect(merged.result.cards[0].tags).toEqual(['React', 'Remote']);
    expect(daemon.service.board.events()[0]).toMatchObject({
      version: currentEventVersion,
      actor: 'user',
    });
  });

  it('previews and applies stale submissions only for the selected cards', async () => {
    const { request } = await fixture(15442);
    const register = async (company: string, days: number) =>
      (
        await request<Card>('/tracking/external', 'POST', {
          company,
          title: 'Fictional Analyst',
          submittedAt: new Date(Date.now() - days * day).toISOString(),
          note: 'Confirmed on a fictional careers page.',
        })
      ).result;
    const first = await register('Lantern Health', 30);
    const second = await register('Quill Systems', 25);
    await register('Mosaic Labs', 3);
    const preview = (
      await request<{ days: number; cards: StaleSubmission[] }>('/insights/stale?days=21')
    ).result;
    expect(preview.cards.map((card) => card.id)).toEqual([first.id, second.id]);
    expect((await request('/insights/stale?days=0')).response.status).toBe(400);
    const applied = await request<{ cards: Card[] }>('/insights/stale', 'POST', {
      days: 21,
      note: 'Fictional cleanup',
      cards: [{ id: first.id, updatedAt: preview.cards[0].updatedAt }],
    });
    expect(applied.result.cards).toEqual([
      expect.objectContaining({
        id: first.id,
        state: 'ghosted',
        statusEffectiveAt: preview.cards[0].staleAt,
      }),
    ]);
    const { result } = await request<{ cards: Card[] }>('/snapshot');
    expect(result.cards.find((card) => card.id === second.id)?.state).toBe('submitted');
  });
});

describe('application insights gateway', () => {
  it('requires read applications or pipeline review on an active run', async () => {
    const { daemon, permit, agent, request } = await fixture(15443);
    const card = (
      await request<Card>('/cards', 'POST', {
        company: 'Harbor Freight Labs',
        title: 'Data Engineer',
        tags: ['Python'],
      })
    ).result;
    await request(`/cards/${card.id}/weight`, 'PUT', { weight: 1 });
    await request(`/cards/${card.id}/lessons`, 'POST', { text: 'Short take-home went well.' });
    const denied = await agent('application_insights', { input: {} });
    expect(denied.result.error).toContain('Enable read applications or pipeline review');
    permit({ readApplications: true });
    const read = await agent<{ total: number; tags: { tag: string }[]; lessons: object }>(
      'application_insights',
      { input: { tag: 'python' } },
    );
    expect(read.result).toMatchObject({
      total: 1,
      outcomes: { pending: 1 },
      tags: [{ tag: 'Python', count: 1, averageWeight: 1 }],
      lessons: { pending: [expect.objectContaining({ text: 'Short take-home went well.' })] },
      truncated: false,
    });
    permit({ reviewPipeline: true });
    expect((await agent('application_insights')).response.status).toBe(200);
    expect((await agent('application_insights', { input: { tagLimit: 99 } })).response.status).toBe(
      400,
    );
    permit({});
    expect((await agent('application_insights')).result.error).toContain('Enable read');
    permit({ readApplications: true });
    daemon.service.controllers.get('insights-fixture')!.abort();
    expect((await agent('application_insights')).response.status).toBe(400);
  });

  it('bounds the response size by shortening lists', async () => {
    const { daemon, permit, agent } = await fixture(15444);
    permit({ readApplications: true });
    for (let index = 0; index < 60; index++) {
      const card = daemon.service.board.createCard({
        company: `Fictional Company ${'Ü'.repeat(80)} ${index}`,
        title: `Fictional Role ${'é'.repeat(140)}`,
        location: 'Remote',
        url: '',
        salary: '',
        description: '',
        tags: Array.from({ length: 10 }, (_, tag) => `${'ß'.repeat(30)}-${index}-${tag}`),
      });
      daemon.service.board.record(
        'card',
        {
          ...card,
          state: (['rejected', 'offer', 'withdrawn', 'lead'] as const)[index % 4],
          lessons: Array.from({ length: 20 }, (_, item) => ({
            id: `${index}-${item}`,
            text: 'Ω'.repeat(1000),
            createdAt: new Date(Date.UTC(2026, 0, 1, 0, item)).toISOString(),
          })),
        },
        'user',
        'Fixture lessons',
      );
    }
    const { result, response } = await agent<{
      truncated: boolean;
      tags: unknown[];
      lessons: Record<string, { text: string }[]>;
    }>('application_insights', { input: { tagLimit: 50, lessonLimit: 10 } });
    expect(response.status).toBe(200);
    expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThanOrEqual(
      insightsByteLimit,
    );
    expect(result.truncated).toBe(true);
    expect(result.lessons.negative[0].text.length).toBeLessThanOrEqual(501);
  });
});
