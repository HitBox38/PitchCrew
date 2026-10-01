import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorManager, googleScopes } from '../src/connectors/manager.ts';
import { getConnectorTool } from '../src/connectors/tools.ts';

let directory: string;
let manager: ConnectorManager;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
const signal = () => new AbortController().signal;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pitchcrew-connectors-test-'));
  fetcher = vi.fn<typeof fetch>();
  manager = new ConnectorManager(directory, fetcher);
  await manager.initialize();
});
afterEach(async () => {
  await manager.close();
  vi.unstubAllEnvs();
  expect(resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-connectors-test-'))).toBe(true);
  await rm(directory, { recursive: true, force: true });
});
async function googleFixture(overrides: Record<string, unknown> = {}) {
  await writeFile(
    join(directory, 'connectors/credentials.json'),
    JSON.stringify({
      version: 1,
      google: {
        account: 'fixture@example.com',
        accessToken: 'fixture-access',
        refreshToken: 'fixture-refresh',
        expiresAt: Date.now() + 3600000,
        scopes: Object.values(googleScopes),
        clientId: 'fixture-client',
        clientSecret: 'fixture-secret',
        ...overrides,
      },
    }),
  );
  await manager.initialize();
}
describe('connector credentials and API boundaries', () => {
  it('has side-effect-free status and rejects access until connected', async () => {
    expect(manager.status().every((c) => !c.connected)).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(manager.call('gmail_search_messages', {}, signal())).rejects.toThrow(
      'Connect Google',
    );
    await expect(manager.call('gmail_send_message', {}, signal())).rejects.toThrow('not allowed');
    await expect(manager.call('constructor', {}, signal())).rejects.toThrow('not allowed');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('validates GitHub credentials, keeps them out of status, persists and removes them', async () => {
    fetcher.mockResolvedValueOnce(json({ login: 'fixture-user' }));
    const status = await manager.connectGithub({ token: 'fixture-token' });
    expect(status[0]).toMatchObject({ connected: true, account: 'fixture-user' });
    expect(JSON.stringify(status)).not.toContain('fixture-token');
    if (process.platform !== 'win32') {
      expect((await stat(join(directory, 'connectors/credentials.json'))).mode & 0o777).toBe(0o600);
      expect((await stat(join(directory, 'connectors'))).mode & 0o777).toBe(0o700);
    }
    const restarted = new ConnectorManager(directory, fetcher);
    await restarted.initialize();
    expect(restarted.status()[0].connected).toBe(true);
    await restarted.close();
    await manager.disconnect('github');
    expect(await readFile(join(directory, 'connectors/credentials.json'), 'utf8')).not.toContain(
      'fixture-token',
    );
    await expect(manager.call('github_list_repositories', {}, signal())).rejects.toThrow(
      'Connect GitHub',
    );
  });
  it('rejects invalid credentials without leaking provider bodies', async () => {
    fetcher.mockResolvedValueOnce(json({ message: 'fixture-secret-token' }, 401));
    await expect(manager.connectGithub({ token: 'fixture-token' })).rejects.toThrow('Reconnect');
    expect(manager.status()[0].connected).toBe(false);
    await expect(readFile(join(directory, 'connectors/credentials.json'))).rejects.toThrow();
  });
  it('builds fixed GET requests, preserves pagination and decodes repository files', async () => {
    fetcher.mockResolvedValueOnce(json({ login: 'fixture-user' })).mockResolvedValueOnce(
      json({
        encoding: 'base64',
        path: 'README.md',
        content: Buffer.from('Fixture project').toString('base64'),
      }),
    );
    await manager.connectGithub({ token: 'fixture-token' });
    expect(
      await manager.call('github_read_file', { owner: 'fixture', repo: 'portfolio' }, signal()),
    ).toMatchObject({ text: 'Fixture project' });
    const [url, options] = fetcher.mock.calls[1];
    expect(String(url)).toBe('https://api.github.com/repos/fixture/portfolio/contents/README.md');
    expect(options).toMatchObject({
      method: 'GET',
      redirect: 'error',
      headers: { authorization: 'Bearer fixture-token' },
    });
    for (const path of ['../secret', '/user', 'foo/../../secret'])
      expect(() =>
        getConnectorTool('github_read_file').request({ owner: 'fixture', repo: 'portfolio', path }),
      ).toThrow();
    expect(
      getConnectorTool('gmail_search_messages')
        .request({ pageToken: 'fixture-cursor', limit: 5 })
        .url.searchParams.get('pageToken'),
    ).toBe('fixture-cursor');
    expect(() =>
      getConnectorTool('github_list_repositories').request({ method: 'POST' }),
    ).toThrow();
  });
  it('decodes multipart Gmail text and does not modify labels', async () => {
    await googleFixture();
    fetcher.mockResolvedValueOnce(
      json({
        id: 'fixture-message',
        payload: {
          headers: [{ name: 'Subject', value: 'Fixture interview' }],
          parts: [
            {
              mimeType: 'text/plain',
              body: { data: Buffer.from('Interview on Tuesday').toString('base64url') },
            },
            {
              mimeType: 'text/html',
              body: { data: Buffer.from('<script>untrusted</script>').toString('base64url') },
            },
          ],
        },
      }),
    );
    const result = await manager.call(
      'gmail_get_message',
      { messageId: 'fixture-message' },
      signal(),
    );
    expect(result).toMatchObject({
      text: 'Interview on Tuesday',
      sourceTrust: expect.stringContaining('untrusted'),
    });
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
    expect(JSON.stringify(result)).not.toContain('<script>');
  });
  it('enforces granted scopes and bounded text, ranges and time windows', async () => {
    await googleFixture({ scopes: [googleScopes.gmail] });
    await expect(manager.call('google_drive_search_files', {}, signal())).rejects.toThrow(
      'not granted',
    );
    expect(fetcher).not.toHaveBeenCalled();
    await googleFixture();
    fetcher.mockResolvedValueOnce(
      new Response('binary', { headers: { 'content-type': 'application/pdf' } }),
    );
    await expect(
      manager.call('google_drive_read_text_file', { fileId: 'fixture-file' }, signal()),
    ).rejects.toThrow('not supported text');
    expect(() =>
      getConnectorTool('google_sheets_read_range').request({
        spreadsheetId: 'fixture-sheet',
        range: 'A:Z',
      }),
    ).toThrow('bounded A1');
    expect(() =>
      getConnectorTool('google_calendar_list_events').request({
        timeMin: '2026-10-02T00:00:00Z',
        timeMax: '2026-10-01T00:00:00Z',
      }),
    ).toThrow('must be after');
    const url = getConnectorTool('google_sheets_read_range').request({
      spreadsheetId: 'fixture-sheet',
      range: 'Jobs!A1:F50',
    }).url;
    expect(url.origin).toBe('https://sheets.googleapis.com');
  });
  it('coalesces refreshes and persists renewed tokens without exposing them', async () => {
    await googleFixture({ expiresAt: 0 });
    fetcher.mockImplementation(async (url) =>
      String(url).includes('oauth2.googleapis.com/token')
        ? json({ access_token: 'fixture-renewed', expires_in: 3600 })
        : json({ messages: [] }),
    );
    await Promise.all([
      manager.call('gmail_search_messages', {}, signal()),
      manager.call('gmail_search_messages', {}, signal()),
    ]);
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/token'))).toHaveLength(1);
    expect(
      fetcher.mock.calls
        .filter(([url]) => String(url).includes('/messages'))
        .every(
          ([, init]) =>
            (init?.headers as Record<string, string> | undefined)?.authorization ===
            'Bearer fixture-renewed',
        ),
    ).toBe(true);
    expect(await readFile(join(directory, 'connectors/credentials.json'), 'utf8')).toContain(
      'fixture-renewed',
    );
    expect(JSON.stringify(manager.status())).not.toContain('fixture-renewed');
  });
  it('does not restore credentials when disconnect races a refresh', async () => {
    await googleFixture({ expiresAt: 0 });
    let complete!: (response: Response) => void;
    fetcher.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const call = manager.call('gmail_search_messages', {}, signal());
    const rejected = expect(call).rejects.toThrow();
    await manager.disconnect('google');
    complete(json({ access_token: 'fixture-renewed', expires_in: 3600 }));
    await rejected;
    expect(manager.status()[1].connected).toBe(false);
    expect(await readFile(join(directory, 'connectors/credentials.json'), 'utf8')).not.toContain(
      'fixture-renewed',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects cancelled runs, oversized responses and binary downloads', async () => {
    await googleFixture({ expiresAt: 0 });
    const controller = new AbortController();
    controller.abort();
    await expect(manager.call('gmail_search_messages', {}, controller.signal)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await googleFixture();
    fetcher.mockResolvedValueOnce(
      new Response('x'.repeat(2_000_001), { headers: { 'content-type': 'text/plain' } }),
    );
    await expect(
      manager.call('google_docs_get_document', { documentId: 'fixture-doc' }, signal()),
    ).rejects.toThrow('too large');
    fetcher.mockResolvedValueOnce(json({ data: 'x'.repeat(80001) }));
    await expect(
      manager.call('google_drive_get_file', { fileId: 'fixture-file' }, signal()),
    ).rejects.toThrow('Too much content');
  });
});
describe('Google Desktop OAuth', () => {
  it('validates single-use state and PKCE, supports partial consent, and saves offline credentials', async () => {
    const { authorizationUrl } = await manager.connectGoogle({
      clientId: 'fixture-client',
      clientSecret: 'fixture-client-secret',
    });
    const auth = new URL(authorizationUrl);
    expect(auth.origin).toBe('https://accounts.google.com');
    expect(auth.searchParams.get('code_challenge_method')).toBe('S256');
    expect(auth.searchParams.get('scope')).not.toContain('gmail.send');
    await expect(manager.connectGoogle({ clientId: 'fixture-client' })).rejects.toThrow(
      'already in progress',
    );
    const callback = new URL(auth.searchParams.get('redirect_uri')!);
    callback.search = new URLSearchParams({
      state: 'incorrect-state',
      code: 'fixture-code',
    }).toString();
    expect((await fetch(callback)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    fetcher
      .mockResolvedValueOnce(
        json({
          access_token: 'fixture-access',
          refresh_token: 'fixture-refresh',
          expires_in: 3600,
          scope: googleScopes.gmail,
        }),
      )
      .mockResolvedValueOnce(json({ email: 'fixture@example.com' }));
    callback.searchParams.set('state', auth.searchParams.get('state')!);
    const response = await fetch(callback);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('connected to Pitchcrew');
    expect(manager.status()[1]).toMatchObject({
      connected: true,
      account: 'fixture@example.com',
      services: ['gmail'],
      pending: false,
    });
    const exchange = fetcher.mock.calls[0][1]?.body as URLSearchParams;
    const { createHash } = await import('node:crypto');
    expect(createHash('sha256').update(exchange.get('code_verifier')!).digest('base64url')).toBe(
      auth.searchParams.get('code_challenge'),
    );
    expect(exchange.get('redirect_uri')).toBe(auth.searchParams.get('redirect_uri'));
    expect(JSON.stringify(manager.status())).not.toContain('fixture-refresh');
    await expect(fetch(callback)).rejects.toThrow();
  });
  it('handles declined consent and cancellation without storing credentials', async () => {
    const { authorizationUrl } = await manager.connectGoogle({ clientId: 'fixture-client' });
    const auth = new URL(authorizationUrl);
    const callback = new URL(auth.searchParams.get('redirect_uri')!);
    callback.search = new URLSearchParams({
      state: auth.searchParams.get('state')!,
      error: 'access_denied',
    }).toString();
    expect((await fetch(callback)).status).toBe(400);
    expect(manager.status()[1]).toMatchObject({
      connected: false,
      pending: false,
      error: expect.stringContaining('declined'),
    });
    expect(fetcher).not.toHaveBeenCalled();
    const next = await manager.connectGoogle({ clientId: 'fixture-client' });
    await manager.disconnect('google');
    await expect(
      fetch(new URL(next.authorizationUrl).searchParams.get('redirect_uri')!),
    ).rejects.toThrow();
    expect(manager.status()[1].connected).toBe(false);
  });
});
