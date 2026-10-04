import type { ApplicationImportReport, Card } from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);
const csv = [
  'company,title,state,submittedAt,history,tags,notes',
  'Fictional Labs,Frontend Engineer,interviewing,2025-01-02T09:00:00Z,submitted@2025-01-02T09:00:00Z;screening@2025-01-10T00:00:00Z;interviewing@2025-01-20T00:00:00Z,remote,Met the team.',
  'Sample Co,Data Analyst,draft,,,,',
].join('\n');

it('imports past applications only through the user session with preview, digest and retry safety', async () => {
  const { daemon, request } = await setup(15371);
  const body = { format: 'csv', content: csv };
  const outside = await fetch(`${daemon.url}/api/tracking/import/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(outside.status).toBe(403);
  daemon.service.capabilities.set('import-token', {
    roleId: 'scout',
    cardId: null,
    runId: 'import-fixture',
  });
  const bearer = await fetch(`${daemon.url}/api/tracking/import/apply`, {
    method: 'POST',
    headers: { authorization: 'Bearer import-token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(bearer.status).toBe(403);
  const agent = await fetch(`${daemon.url}/api/agent`, {
    method: 'POST',
    headers: { authorization: 'Bearer import-token', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'import_applications', input: body }),
  });
  expect(agent.status).toBe(400);
  daemon.service.capabilities.delete('import-token');

  const preview = await request<ApplicationImportReport>('/tracking/import/preview', 'POST', body);
  expect(preview.response.status).toBe(200);
  expect(preview.result.counts).toMatchObject({ new: 2, invalid: 0 });
  expect(daemon.service.board.list('card')).toEqual([]);
  expect(
    (
      await request('/tracking/import/apply', 'POST', {
        ...body,
        content: `${csv}\nOther Co,Engineer,lead`,
        digest: preview.result.digest,
      })
    ).response.status,
  ).toBe(400);
  const applied = await request<ApplicationImportReport>('/tracking/import/apply', 'POST', {
    ...body,
    digest: preview.result.digest,
  });
  expect(applied.result.counts).toMatchObject({ created: 2, failed: 0 });
  const cards = daemon.service.board.list<Card>('card');
  expect(cards.map((card) => [card.company, card.state])).toEqual([
    ['Fictional Labs', 'interviewing'],
    ['Sample Co', 'lead'],
  ]);
  expect(cards[0]).toMatchObject({
    statusEffectiveAt: '2025-01-20T00:00:00.000Z',
    tracking: { origin: 'external', submittedAt: '2025-01-02T09:00:00.000Z' },
  });
  expect(daemon.service.board.list('approval')).toEqual([]);
  const retry = await request<ApplicationImportReport>('/tracking/import/apply', 'POST', {
    ...body,
    digest: preview.result.digest,
  });
  expect(retry.result.counts).toMatchObject({ imported: 2, created: 0 });
  expect(daemon.service.board.list('card')).toHaveLength(2);

  const large = await request('/tracking/import/preview', 'POST', {
    format: 'csv',
    content: `company,state\n${'A,lead\n'.repeat(400000)}`,
  });
  expect(large.response.status).toBe(400);
  expect((large.result as { error: string }).error).toContain('at most 2 MB');
  const many = await request('/tracking/import/preview', 'POST', {
    format: 'json',
    content: JSON.stringify(Array.from({ length: 1001 }, () => ({ company: 'A', state: 'lead' }))),
  });
  expect((many.result as { error: string }).error).toContain('at most 1000');
});
