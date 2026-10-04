import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConnectorManager, googleScopes } from '../src/connectors/manager.ts';
import {
  GoogleCliMissingError,
  type GoogleCliRunner,
} from '../src/connectors/auth/google-cli-process.ts';

let directory: string;
let manager: ConnectorManager;
let runner: ReturnType<typeof vi.fn<GoogleCliRunner>>;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
const signal = () => new AbortController().signal;
const account = (user = 'fictional@example.com', scopes = Object.values(googleScopes)) => ({
  stdout: JSON.stringify({
    token_valid: true,
    user,
    scopes,
    token_error: 'fictional-secret-never-forward',
  }),
  exitCode: 0,
});
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pitchcrew-google-cli-test-'));
  runner = vi.fn<GoogleCliRunner>();
  fetcher = vi.fn<typeof fetch>();
  manager = new ConnectorManager(directory, fetcher, undefined, runner);
  await manager.initialize();
});
afterEach(async () => {
  await manager.close();
  vi.unstubAllEnvs();
  expect(resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-google-cli-test-'))).toBe(true);
  await rm(directory, { recursive: true, force: true });
});
async function connect() {
  runner
    .mockResolvedValueOnce({ stdout: 'gws fixture', exitCode: 0 })
    .mockResolvedValueOnce(account());
  return manager.connectGoogleCli();
}
it('persists only the existing account and scopes without probing on snapshots or restart', async () => {
  manager.status();
  expect(runner).not.toHaveBeenCalled();
  expect((await connect())[1]).toMatchObject({
    connected: true,
    pending: false,
    connectionMethod: 'cli',
    googleCliState: 'ready',
    services: ['gmail', 'drive', 'calendar', 'sheets'],
  });
  expect(runner.mock.calls.map(([args]) => args)).toEqual([['--version'], ['auth', 'status']]);
  expect(
    JSON.parse(await readFile(join(directory, 'connectors/credentials.json'), 'utf8')),
  ).toEqual({
    version: 1,
    google: { mode: 'cli', account: 'fictional@example.com', scopes: Object.values(googleScopes) },
  });
  const restarted = new ConnectorManager(directory, fetcher, undefined, runner);
  await restarted.initialize();
  expect(restarted.status()[1].connectionMethod).toBe('cli');
  await restarted.close();
  expect(runner).toHaveBeenCalledTimes(2);
  expect(fetcher).not.toHaveBeenCalled();
});

const cases = [
  [
    'gmail_search_messages',
    { query: 'from:fixture@example.com; --send', limit: 7, pageToken: 'next' },
    ['gmail', 'users', 'messages', 'list'],
    { userId: 'me', q: 'from:fixture@example.com; --send', maxResults: 7, pageToken: 'next' },
  ],
  [
    'gmail_get_message',
    { messageId: 'message-1' },
    ['gmail', 'users', 'messages', 'get'],
    { userId: 'me', id: 'message-1', format: 'full' },
  ],
  [
    'gmail_get_thread',
    { threadId: 'thread-1' },
    ['gmail', 'users', 'threads', 'get'],
    { userId: 'me', id: 'thread-1', format: 'full' },
  ],
  [
    'google_drive_search_files',
    { query: '', limit: 4, pageToken: 'cursor' },
    ['drive', 'files', 'list'],
    {
      q: 'trashed = false',
      pageSize: 4,
      pageToken: 'cursor',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    },
  ],
  [
    'google_drive_get_file',
    { fileId: 'file-1' },
    ['drive', 'files', 'get'],
    { fileId: 'file-1', supportsAllDrives: true },
  ],
  [
    'google_drive_read_text_file',
    { fileId: 'file-1' },
    ['drive', 'files', 'get'],
    { fileId: 'file-1', alt: 'media', supportsAllDrives: true },
  ],
  [
    'google_docs_get_document',
    { documentId: 'doc-1' },
    ['drive', 'files', 'export'],
    { fileId: 'doc-1', mimeType: 'text/plain' },
  ],
  [
    'google_sheets_read_range',
    { spreadsheetId: 'sheet-1', range: "'Fictional jobs'!A1:B5" },
    ['sheets', 'spreadsheets', 'values', 'get'],
    { spreadsheetId: 'sheet-1', range: "'Fictional jobs'!A1:B5" },
  ],
  [
    'google_calendar_list_events',
    {
      calendarId: 'fixture@example.com',
      timeMin: '2026-01-01T00:00:00Z',
      timeMax: '2026-02-01T00:00:00Z',
      limit: 2,
    },
    ['calendar', 'events', 'list'],
    { calendarId: 'fixture@example.com', singleEvents: true, orderBy: 'startTime', maxResults: 2 },
  ],
] as const;
it.each(cases)(
  'maps %s to a fixed read method and preserves validated parameters',
  async (name, input, method, params) => {
    await connect();
    runner
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce({ stdout: '{}', exitCode: 0, text: 'Fictional note' });
    const result = await manager.call(name, input, signal());
    const args = runner.mock.lastCall![0];
    expect(args.slice(0, method.length)).toEqual(method);
    expect(args[method.length]).toBe('--params');
    expect(JSON.parse(args[method.length + 1]!)).toMatchObject(params);
    expect(args).toHaveLength(method.length + 2);
    expect(runner.mock.calls[2]![0]).toEqual(['auth', 'status']);
    expect(result.sourceTrust).toContain('untrusted');
    if (name === 'google_docs_get_document' || name === 'google_drive_read_text_file')
      expect(result).toMatchObject({ data: { text: 'Fictional note' } });
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it('retains Gmail decoding and thread transformations', async () => {
  await connect();
  const message = {
    id: 'message',
    payload: {
      mimeType: 'text/plain',
      body: { data: Buffer.from('Fictional recruiter note').toString('base64url') },
    },
  };
  runner.mockResolvedValueOnce(account()).mockResolvedValueOnce({
    stdout: JSON.stringify({ id: 'thread', messages: [message] }),
    exitCode: 0,
  });
  expect(await manager.call('gmail_get_thread', { threadId: 'thread' }, signal())).toMatchObject({
    id: 'thread',
    messages: [{ id: 'message', text: 'Fictional recruiter note' }],
  });
});
it('rejects changed accounts before a resource read', async () => {
  await connect();
  runner.mockResolvedValueOnce(account('different@example.com'));
  await expect(manager.call('gmail_search_messages', {}, signal())).rejects.toThrow(
    'account changed',
  );
  expect(runner).toHaveBeenCalledTimes(3);
  expect(manager.status()[1].googleCliState).toBe('account_changed');
});
it('rejects revoked scopes and updates the locally reported granted services', async () => {
  await connect();
  runner.mockResolvedValueOnce(account('fictional@example.com', [googleScopes.drive]));
  await expect(manager.call('gmail_search_messages', {}, signal())).rejects.toThrow('not granted');
  expect(manager.status()[1]).toMatchObject({
    services: ['drive'],
    googleCliState: 'scopes_missing',
  });
  expect(runner).toHaveBeenCalledTimes(3);
});
it('accepts broader existing native grants but still runs only read methods', async () => {
  runner
    .mockResolvedValueOnce({ stdout: 'version', exitCode: 0 })
    .mockResolvedValueOnce(
      account('fictional@example.com', ['https://www.googleapis.com/auth/drive']),
    );
  expect((await manager.connectGoogleCli())[1].services).toEqual(['drive']);
});
it('gives safe missing, sign-in and permission guidance without forwarding CLI errors', async () => {
  runner.mockRejectedValueOnce(new GoogleCliMissingError());
  await expect(manager.connectGoogleCli()).rejects.toThrow('Install');
  expect(manager.status()[1].googleCliState).toBe('missing');
  runner.mockResolvedValueOnce({ stdout: 'version', exitCode: 0 }).mockResolvedValueOnce({
    stdout: JSON.stringify({ token_error: 'fictional-secret' }),
    exitCode: 1,
  });
  await expect(manager.connectGoogleCli()).rejects.toThrow('gws auth login --readonly');
  expect(JSON.stringify(manager.status())).not.toContain('fictional-secret');
  runner
    .mockResolvedValueOnce({ stdout: 'version', exitCode: 0 })
    .mockResolvedValueOnce(account('fictional@example.com', []));
  await expect(manager.connectGoogleCli()).rejects.toThrow('No supported');
});
it('validates tool inputs before invoking gws and bounds transformed output', async () => {
  await connect();
  await expect(manager.call('gmail_search_messages', { limit: 500 }, signal())).rejects.toThrow();
  await expect(manager.call('gmail_send_message', {}, signal())).rejects.toThrow();
  expect(runner).toHaveBeenCalledTimes(2);
  runner
    .mockResolvedValueOnce(account())
    .mockResolvedValueOnce({ stdout: JSON.stringify({ text: 'x'.repeat(80001) }), exitCode: 0 });
  await expect(manager.call('google_drive_get_file', { fileId: 'file' }, signal())).rejects.toThrow(
    'Too much content',
  );
});
it('disconnect removes only the binding and rejects delayed connection results', async () => {
  let release!: (result: Awaited<ReturnType<GoogleCliRunner>>) => void;
  runner.mockResolvedValueOnce({ stdout: 'version', exitCode: 0 }).mockImplementationOnce(
    () =>
      new Promise((resolveResult) => {
        release = resolveResult;
      }),
  );
  const connecting = manager.connectGoogleCli();
  const rejection = expect(connecting).rejects.toThrow();
  await vi.waitFor(() => expect(release).toBeDefined());
  await manager.disconnect('google');
  release(account());
  await rejection;
  expect(manager.status()[1].connected).toBe(false);
  expect(runner.mock.calls.flatMap(([args]) => args)).not.toContain('logout');
});
it('cancels delayed CLI reads when disconnected', async () => {
  await connect();
  let release!: (result: Awaited<ReturnType<GoogleCliRunner>>) => void;
  runner.mockResolvedValueOnce(account()).mockImplementationOnce(
    () =>
      new Promise((resolveResult) => {
        release = resolveResult;
      }),
  );
  const reading = manager.call('gmail_search_messages', {}, signal());
  const rejection = expect(reading).rejects.toThrow();
  await vi.waitFor(() => expect(release).toBeDefined());
  await manager.disconnect('google');
  release({ stdout: '{}', exitCode: 0 });
  await rejection;
  expect(manager.status()[1]).toMatchObject({ connected: false, error: '' });
});
