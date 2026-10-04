import cookiePlugin from '@fastify/cookie';
import type { Approval } from '@pitchcrew/core';
import { verifiedArtifact } from '@pitchcrew/packet';
import Fastify, { type FastifyInstance } from 'fastify';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerSessionSecurity } from '../src/http/security.ts';
import { registerUi } from '../src/http/ui.ts';
import { packet } from '../../board/test/fixtures/packet.ts';
import { cleanup, setup } from './helpers/daemon.ts';

const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await cleanup();
});

describe('HTTP framework contracts', () => {
  it('rejects untrusted requests before parsing and preserves session/security headers', async () => {
    const { daemon, cookie } = await setup(15001, false, { dev: false });
    const page = await fetch(`${daemon.url}/chat/scout`);
    expect(page.headers.get('set-cookie')).toMatch(/pitchcrew_session=.*Max-Age=86400/);
    expect(page.headers.get('set-cookie')).toContain('HttpOnly');
    expect(page.headers.get('set-cookie')).toContain('SameSite=Strict');
    expect(page.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(page.headers.get('x-content-type-options')).toBe('nosniff');
    expect(page.headers.get('referrer-policy')).toBe('no-referrer');
    const base = { host: new URL(daemon.url).host, cookie, 'x-pitchcrew-client': 'ui' };
    for (const extra of [
      { host: 'localhost:15001' },
      { origin: 'https://example.invalid' },
      { 'sec-fetch-site': 'cross-site' },
      { cookie: 'pitchcrew_session=expired' },
      { 'x-pitchcrew-client': 'other' },
    ]) {
      const response = await daemon.app.inject({
        method: 'POST',
        url: '/api/cards',
        headers: { ...base, 'content-type': 'application/json', ...extra },
        payload: '{',
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toHaveProperty('error');
    }
    expect((await fetch(`${daemon.url}/api/health`)).status).toBe(200);
    expect((await fetch(`${daemon.url}/api/chat/stream`)).status).toBe(403);
    const agent = await daemon.app.inject({
      method: 'POST',
      url: '/api/agent',
      headers: { host: base.host },
      payload: { action: 'profile' },
    });
    expect(agent.statusCode).toBe(403);
    expect(agent.json().error).toContain('capability');
    expect(daemon.service.board.list('card')).toHaveLength(0);
  });

  it('accepts bodyless JSON actions and keeps parser and domain errors in the API envelope', async () => {
    const { daemon, request, cookie } = await setup(15002);
    expect((await request('/runtimes/demo/models', 'POST')).response.status).toBe(200);
    const before = daemon.service.board.events();
    for (const body of ['{', 'null', '"text"']) {
      const response = await fetch(`${daemon.url}/api/cards`, {
        method: 'POST',
        headers: { cookie, 'x-pitchcrew-client': 'ui', 'content-type': 'application/json' },
        body,
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toHaveProperty('error');
    }
    // An early oversized-body rejection can reset the TCP upload before fetch sees
    // the response on macOS. Inject exercises the actual parser/error envelope
    // deterministically; small malformed bodies above still use loopback HTTP.
    const create = vi.spyOn(daemon.service, 'createCard');
    const oversized = await daemon.app.inject({
      method: 'POST',
      url: '/api/cards',
      headers: {
        host: new URL(daemon.url).host,
        cookie,
        'x-pitchcrew-client': 'ui',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ content: 'x'.repeat(1024 * 1024) }),
    });
    expect(oversized.statusCode).toBe(400);
    expect(oversized.json()).toHaveProperty('error');
    expect(create).not.toHaveBeenCalled();
    create.mockRestore();
    const invalid = await request<{ error: string }>('/cards', 'POST', {});
    expect(invalid.response.status).toBe(400);
    expect(invalid.result.error).toEqual(expect.any(String));
    const missing = await request<{ error: string }>('/not-a-route');
    expect(missing.response.status).toBe(404);
    expect(missing.result).toEqual({ error: 'Route not found.' });
    expect(daemon.service.board.events()).toEqual(before);
  });

  it('closes an open SSE connection and shuts down the service through Fastify', async () => {
    const { daemon, cookie } = await setup(15003, false, { dev: false });
    const close = vi.spyOn(daemon.service, 'close');
    const response = await fetch(`${daemon.url}/api/chat/stream`, {
      headers: { cookie, 'x-pitchcrew-client': 'ui' },
    });
    expect(response.headers.get('content-security-policy')).toContain("connect-src 'self'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('data: ');
    const ended = reader.read().then(
      () => true,
      () => true,
    );
    await daemon.close();
    expect(await ended).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    expect(daemon.http.listening).toBe(false);
    await daemon.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it('serves the exact reviewed PDF/DOCX bytes without consuming the export approval', async () => {
    const { daemon, request, cookie } = await setup(15006);
    const card = daemon.service.createCard({ company: 'Fixture Co', title: 'Engineer' });
    daemon.service.board.record(
      'card',
      { ...card, state: 'agreed', packet },
      'reviewer',
      'Fixture review',
    );
    const { response, result: approval } = await request<Approval>(
      `/cards/${card.id}/approval`,
      'POST',
      {
        formats: ['pdf', 'docx'],
      },
    );
    expect(response.status).toBe(201);
    expect(approval.artifacts).toHaveLength(4);
    for (const artifact of approval.artifacts!) {
      const url = `${daemon.url}/api/approvals/${approval.id}/artifacts/${artifact.name}`;
      expect((await fetch(url)).status).toBe(403);
      const preview = await fetch(url, { headers: { cookie, 'x-pitchcrew-client': 'ui' } });
      expect(preview.status).toBe(200);
      expect(preview.headers.get('content-type')).toBe(artifact.mimeType);
      expect(preview.headers.get('content-disposition')).toBe(
        `inline; filename="${artifact.name}"`,
      );
      expect(Buffer.from(await preview.arrayBuffer())).toEqual(verifiedArtifact(artifact));
    }
    expect(daemon.service.board.get<Approval>('approval', approval.id).status).toBe('pending');
  });

  it('serves production assets and SPA deep links with the same security hooks', async () => {
    const { directory } = await setup(15004);
    const uiRoot = join(directory, 'ui-fixture');
    await mkdir(join(uiRoot, 'dist/assets'), { recursive: true });
    const html = '<!doctype html><html><body>Fixture workspace</body></html>';
    await writeFile(join(uiRoot, 'dist/index.html'), html);
    await writeFile(join(uiRoot, 'dist/assets/app.js'), 'console.log("fixture");');
    const app = Fastify();
    apps.push(app);
    await app.register(cookiePlugin);
    registerSessionSecurity(app, { port: 15004 }, 'http://127.0.0.1:15004', new Set());
    await registerUi(app, false, uiRoot);
    const headers = { host: '127.0.0.1:15004' };
    for (const url of ['/', '/chat/scout', '/skills?filter=scout', '/activity?q=fixture']) {
      const page = await app.inject({ url, headers });
      expect(page.statusCode).toBe(200);
      expect(page.body).toBe(html);
      expect(page.headers['content-type']).toContain('text/html');
      expect(page.headers['set-cookie']).toContain('HttpOnly');
      expect(page.headers['content-security-policy']).toContain("default-src 'self'");
    }
    const script = await app.inject({ url: '/assets/app.js', headers });
    expect(script.statusCode).toBe(200);
    expect(script.body).toBe(await readFile(join(uiRoot, 'dist/assets/app.js'), 'utf8'));
    expect(script.headers['content-type']).toContain('javascript');
    expect(script.headers['x-content-type-options']).toBe('nosniff');
    expect(
      (
        await app.inject({
          url: '/chat/scout',
          headers: { ...headers, origin: 'https://evil.invalid' },
        })
      ).statusCode,
    ).toBe(403);
  });

  it('serves Vite deep links and assets without bypassing API or session checks', async () => {
    const { daemon, request } = await setup(15005, false, { dev: true });
    const page = await fetch(`${daemon.url}/chat/scout`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('/@vite/client');
    expect(page.headers.get('set-cookie')).toContain('HttpOnly');
    expect(page.headers.get('x-content-type-options')).toBe('nosniff');
    const client = await fetch(`${daemon.url}/@vite/client`);
    expect(client.status).toBe(200);
    const token = (await client.text()).match(/const wsToken = ("[^"]+");/);
    expect(token).not.toBeNull();
    const socket = new WebSocket(
      `${daemon.url.replace('http:', 'ws:')}/?token=${JSON.parse(token![1])}`,
      'vite-hmr',
    );
    const opened = new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve(), { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    const closed = new Promise<void>((resolve) =>
      socket.addEventListener('close', () => resolve(), { once: true }),
    );
    await opened;
    expect((await request('/snapshot')).response.status).toBe(200);
    expect((await request('/not-a-route')).response.status).toBe(404);
    expect((await fetch(`${daemon.url}/api/snapshot`)).status).toBe(403);
    expect(
      (await fetch(`${daemon.url}/chat/scout`, { headers: { origin: 'https://evil.invalid' } }))
        .status,
    ).toBe(403);
    await daemon.close();
    await closed;
    expect(socket.readyState).toBe(WebSocket.CLOSED);
  });
});
