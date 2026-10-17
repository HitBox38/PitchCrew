import type { ChatMessage, ConversationHistoryPage, Snapshot } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { afterEach, expect, it } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);
it('keeps the full API compatible while the UI loads bounded previews, history pages and full job details', async () => {
  const { daemon, request, cookie } = await setup(15091);
  const card = daemon.service.board.createCard({
    company: 'Fictional',
    title: 'Engineer',
    description: 'Private job source '.repeat(1000),
    sourceHtml: '<article>Captured job</article>',
    location: 'Remote',
    url: '',
    salary: '',
    tags: [],
  });
  const messages: ChatMessage[] = [];
  for (let i = 0; i < 125; i++) {
    const message: ChatMessage = {
      id: randomUUID(),
      threadId: 'scout',
      from: i % 2 ? 'scout' : 'user',
      to: 'scout',
      content: `Fictional ${i} ` + 'x'.repeat(3000),
      createdAt: new Date(1792180000000 + i).toISOString(),
      cardId: null,
      runId: null,
    };
    daemon.service.board.record('message', message, message.from, 'Fictional history');
    messages.push(message);
  }
  const full = await request<Snapshot>('/snapshot');
  const compact = await request<Snapshot>('/snapshot?view=workspace');
  expect(full.result.messages).toHaveLength(125);
  expect(full.result.cards.find((item) => item.id === card.id)?.description).toBe(card.description);
  expect(compact.result.workspace).toBe(true);
  expect(compact.result.messages).toHaveLength(1);
  expect(compact.result.messageHistory?.threads.scout.count).toBe(125);
  expect(compact.result.cards.find((item) => item.id === card.id)).toMatchObject({
    description: '',
  });
  expect(compact.result.cards.find((item) => item.id === card.id)?.sourceHtml).toBeUndefined();
  expect(JSON.stringify(compact.result).length).toBeLessThan(JSON.stringify(full.result).length);
  expect((await request(`/cards/${card.id}`)).result).toEqual(card);
  const latest = (await request<ConversationHistoryPage>('/conversations/scout/history')).result;
  expect(latest.items.map((item) => item.id)).toEqual(
    messages.slice(-50).map((message) => message.id),
  );
  expect(
    (
      await request<ConversationHistoryPage>(`/conversations/scout/history?anchor=${latest.older}`)
    ).result.items.map((item) => item.id),
  ).toEqual(messages.slice(25, 75).map((message) => message.id));
  expect(
    (await request<{ threads: string[] }>('/conversations/search?q=Fictional%200%20')).result
      .threads,
  ).toContain('scout');
  const headers = { host: new URL(daemon.url).host, cookie, 'x-pitchcrew-client': 'ui' };
  const a = await daemon.app.inject({ url: '/api/snapshot?view=workspace', headers });
  const b = await daemon.app.inject({
    url: '/api/snapshot?view=workspace',
    headers: { ...headers, 'if-none-match': String(a.headers.etag) },
  });
  expect(b.statusCode).toBe(304);
  const c = await daemon.app.inject({
    url: '/api/snapshot',
    headers: { ...headers, 'if-none-match': String(a.headers.etag) },
  });
  expect(c.statusCode).toBe(200);
  expect(c.json().messages).toHaveLength(125);
});
it('does not send saved history through the compact event stream or weaken local session checks', async () => {
  const { daemon, cookie } = await setup(15092);
  for (let i = 0; i < 80; i++)
    daemon.service.board.record(
      'message',
      {
        id: randomUUID(),
        threadId: 'scout',
        from: 'user',
        to: 'scout',
        content: 'Fictional private history '.repeat(100),
        cardId: null,
        runId: null,
        createdAt: new Date().toISOString(),
      },
      'user',
      'Fixture',
    );
  const controller = new AbortController();
  try {
    const response = await fetch(`${daemon.url}/api/chat/stream?view=workspace`, {
      headers: { cookie, 'x-pitchcrew-client': 'ui' },
      signal: controller.signal,
    });
    const reader = response.body!.getReader();
    const frame = new TextDecoder().decode((await reader.read()).value);
    const update = JSON.parse(frame.slice(6));
    expect(update.messages).toHaveLength(1);
    expect(update.messages[0].content.length).toBeLessThanOrEqual(240);
    expect(update.messageHistory.threads.scout.count).toBe(80);
    await reader.cancel();
  } finally {
    controller.abort();
  }
  for (const path of [
    '/snapshot?view=workspace',
    '/conversations/scout/history',
    '/conversations/search?q=private',
  ])
    expect((await fetch(`${daemon.url}/api${path}`)).status).toBe(403);
});
