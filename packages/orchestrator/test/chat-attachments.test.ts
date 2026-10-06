import { adapters } from '@pitchcrew/adapters';
import {
  chatAttachmentLimits,
  currentEventVersion,
  decodeEvent,
  type ChatContext,
  type ChatMessage,
  type Run,
} from '@pitchcrew/core';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);
const upload = (
  name = 'notes.md',
  text = '# Fictional candidate\nBuilt accessible interfaces. שלום',
) => ({ name, data: Buffer.from(text).toString('base64') });
function holdChats() {
  const turns: { context: ChatContext; complete: () => void }[] = [];
  vi.spyOn(adapters.demo, 'chat').mockImplementation(
    (context) =>
      new Promise((resolve) =>
        turns.push({
          context,
          complete: () => resolve({ reply: 'Read the fictional attachment.' }),
        }),
      ),
  );
  return turns;
}

it('persists attachments outside events, prepares isolated copies, serves exact bytes and restores history', async () => {
  const turns = holdChats();
  const { daemon, request, cookie, directory } = await setup(14570);
  try {
    const file = upload('Résumé.md');
    const { response, result: run } = await request<Run>('/roles/scout/chat', 'POST', {
      attachments: [file],
    });
    expect(response.status).toBe(202);
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    const message = daemon.service.board.list<ChatMessage>('message')[0];
    expect(message.content).toBe('');
    const attachment = message.attachments![0];
    expect(attachment).toMatchObject({
      name: file.name,
      mimeType: 'text/markdown',
      size: Buffer.from(file.data, 'base64').length,
    });
    expect(attachment.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(await readFile(join(directory, 'chat-attachments', attachment.id))).toEqual(
      Buffer.from(file.data, 'base64'),
    );
    expect(await readFile(turns[0].context.attachments![0].path)).toEqual(
      Buffer.from(file.data, 'base64'),
    );
    expect(turns[0].context.attachments![0].path).toContain(
      join('roles', 'scout', 'runs', run.id, 'attachments'),
    );
    const event = daemon.service.board.events().find((event) => event.entityId === message.id)!;
    expect(decodeEvent(JSON.stringify(event))).toMatchObject({
      version: currentEventVersion,
      data: { attachments: [attachment] },
    });
    expect(JSON.stringify(event)).not.toContain(file.data);
    daemon.service.board.rebuild();
    expect(daemon.service.board.get<ChatMessage>('message', message.id).attachments).toEqual([
      attachment,
    ]);
    const path = `${daemon.url}/api/chat/messages/${message.id}/attachments/${attachment.id}`;
    const download = await fetch(path, { headers: { cookie, 'x-pitchcrew-client': 'ui' } });
    expect(download.status).toBe(200);
    expect(download.headers.get('content-disposition')).toContain(encodeURIComponent(file.name));
    expect(download.headers.get('content-type')).toBe('application/octet-stream');
    expect(Buffer.from(await download.arrayBuffer())).toEqual(Buffer.from(file.data, 'base64'));
    const denied = await fetch(path, { headers: { 'x-pitchcrew-client': 'ui' } });
    expect(denied.status).toBe(403);
    const token = [...daemon.service.capabilities.keys()][0];
    expect(
      await daemon.service.agentCall(token, 'chat_attachment', {
        messageId: message.id,
        attachmentId: attachment.id,
      }),
    ).toMatchObject({ text: Buffer.from(file.data, 'base64').toString('utf8'), truncated: false });
    turns[0].complete();
    await vi.waitFor(() =>
      expect(daemon.service.board.get<Run>('run', run.id).status).toBe('completed'),
    );
    await request('/roles/scout/chat', 'POST', { content: 'Use the same file again.' });
    await vi.waitFor(() => expect(turns).toHaveLength(2));
    expect(turns[1].context.attachments?.[0].id).toBe(attachment.id);
    expect(turns[1].context.attachments?.[0].path).not.toBe(turns[0].context.attachments?.[0].path);
  } finally {
    for (const turn of turns) turn.complete();
  }
});

it('scopes reads to own and crew conversations, returns images, and rejects changed files and expired runs', async () => {
  const turns = holdChats();
  const { daemon, request, directory } = await setup(14571);
  try {
    await request('/roles/scout/chat', 'POST', {
      content: 'Private file',
      attachments: [upload()],
    });
    await request('/roles/writer/chat', 'POST', {
      content: 'Crew file',
      threadId: 'crew',
      attachments: [upload('image.png', 'fixture image bytes')],
    });
    await vi.waitFor(() => expect(turns).toHaveLength(2));
    const [privateMessage, crewMessage] = daemon.service.board.list<ChatMessage>('message');
    const tokenFor = (role: string) =>
      [...daemon.service.capabilities.entries()].find(([, value]) => value.roleId === role)![0];
    const input = (message: ChatMessage) => ({
      messageId: message.id,
      attachmentId: message.attachments![0].id,
    });
    await expect(
      daemon.service.agentCall(tokenFor('writer'), 'chat_attachment', input(privateMessage)),
    ).rejects.toThrow('another role');
    expect(
      await daemon.service.agentCall(tokenFor('scout'), 'chat_attachment', input(crewMessage)),
    ).toMatchObject({
      image: { data: upload('image.png', 'fixture image bytes').data, mimeType: 'image/png' },
    });
    await writeFile(
      join(directory, 'chat-attachments', privateMessage.attachments![0].id),
      'changed',
    );
    await expect(
      daemon.service.agentCall(tokenFor('scout'), 'chat_attachment', input(privateMessage)),
    ).rejects.toThrow('changed');
    const token = tokenFor('scout');
    await request(`/runs/${privateMessage.runId}/cancel`, 'POST');
    await expect(
      daemon.service.agentCall(token, 'chat_attachment', input(crewMessage)),
    ).rejects.toThrow('expired');
  } finally {
    for (const turn of turns) turn.complete();
  }
});

it('rejects invalid or oversized uploads before recording messages and cleans files when a role is busy', async () => {
  const turns = holdChats();
  const { daemon, request, directory } = await setup(14572);
  try {
    for (const body of [
      { content: ' ' },
      { attachments: [upload('../notes.md')] },
      { attachments: [upload('script.exe')] },
      { attachments: [{ name: 'notes.md', data: 'invalid' }] },
      { attachments: Array.from({ length: 6 }, () => upload()) },
      {
        attachments: [
          upload('large.txt', 'a'.repeat(chatAttachmentLimits.bytes)),
          upload('extra.md', 'x'),
        ],
      },
    ])
      expect((await request('/roles/scout/chat', 'POST', body)).response.status).toBe(400);
    expect(daemon.service.board.list('message')).toEqual([]);
    const large = upload('large.txt', 'a'.repeat(1024 * 1024 + 1));
    expect(
      (await request('/roles/scout/chat', 'POST', { attachments: [large] })).response.status,
    ).toBe(202);
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    const token = [...daemon.service.capabilities.keys()][0];
    const message = daemon.service.board.list<ChatMessage>('message')[0];
    expect(
      await daemon.service.agentCall(token, 'chat_attachment', {
        messageId: message.id,
        attachmentId: message.attachments![0].id,
      }),
    ).toMatchObject({ text: 'a'.repeat(chatAttachmentLimits.text), truncated: true });
    expect(
      (await request('/roles/scout/chat', 'POST', { attachments: [upload()] })).response.status,
    ).toBe(400);
    expect(await readdir(join(directory, 'chat-attachments'))).toEqual([
      message.attachments![0].id,
    ]);
  } finally {
    for (const turn of turns) turn.complete();
  }
});

it('still decodes text-only chat events from every previous event version', () => {
  for (let version = 1; version < currentEventVersion; version++)
    expect(
      decodeEvent(JSON.stringify({ version, kind: 'message', data: { content: 'Legacy message' } }))
        .data,
    ).toEqual({ content: 'Legacy message' });
});
