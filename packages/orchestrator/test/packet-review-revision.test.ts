import { adapters } from '@pitchcrew/adapters';
import type { Card, Run } from '@pitchcrew/core';
import { promptFor } from '../../adapters/src/process.ts';
import { packet } from '../../board/test/fixtures/packet.ts';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, confirmFixtureApplication, finish, setup } from './helpers/daemon.ts';
import * as documents from '../src/quality/documents.ts';

afterEach(cleanup);

it('delivers saved review corrections to the next Writer prompt and tools before an independent recheck', async () => {
  const { daemon, request } = await setup(24641);
  const profile = [{ name: 'profile.md', content: 'Built React interfaces.' }];
  await request('/profile', 'PUT', profile[0]);
  const card = daemon.service.createCard({
    company: 'Fictional review retry',
    title: 'Engineer',
    description: 'RAW-SOURCE-EXCLUDED-FROM-REVISION',
  });
  daemon.service.moveCard(card.id, 'shortlisted');
  await confirmFixtureApplication(request, card.id);
  daemon.service.board.move(card.id, 'drafting', 'user');
  await daemon.service.applyResult(
    card.id,
    daemon.service.board.get('role', 'writer'),
    { role: 'writer', packet },
    profile,
  );
  const feedback = [
    'Preserve the explicit allowlist exception in both documents and their claims.',
  ];
  await daemon.service.applyResult(
    card.id,
    daemon.service.board.get('role', 'reviewer'),
    { role: 'reviewer', passed: false, feedback },
    profile,
  );
  vi.spyOn(documents, 'inspectPacketDocuments').mockResolvedValue({
    reports: [],
    errors: [],
    warnings: [],
    repairable: [],
  });
  const calls: string[] = [];
  vi.spyOn(adapters.demo, 'run').mockImplementation(async (context) => {
    calls.push(context.purpose!);
    expect(JSON.stringify(context.card)).not.toContain('RAW-SOURCE-EXCLUDED-FROM-REVISION');
    if (context.purpose === 'application-review') {
      expect(context.card.feedback).toEqual([]);
      return { role: 'reviewer', passed: true, feedback: [] };
    }
    expect(context.card.packet).toEqual(packet);
    expect(context.card.feedback).toEqual(feedback);
    expect(promptFor(context)).toContain(feedback[0]);
    const response = await daemon.service.agentCall(
      context.mcp.env.PITCHCREW_RUN_TOKEN,
      'card',
      {},
    );
    expect((response.card as Card).feedback).toEqual(feedback);
    return { role: 'writer', packet };
  });
  for (const roleId of ['writer', 'reviewer']) {
    const { result, response } = await request<Run>(`/cards/${card.id}/run`, 'POST', { roleId });
    expect(response.status).toBe(202);
    await finish(request, result.id);
  }
  expect(calls).toEqual(['application-draft', 'application-review']);
  expect(daemon.service.board.get<Card>('card', card.id).state).toBe('agreed');
});
