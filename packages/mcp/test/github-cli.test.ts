import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConnectorManager } from '../src/connectors/manager.ts';
import {
  createGithubCliRunner,
  GithubCliMissingError,
  type GithubCliRunner,
} from '../src/connectors/auth/github-cli-process.ts';

let directory: string;
let manager: ConnectorManager;
let runner: ReturnType<typeof vi.fn<GithubCliRunner>>;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
const signal = () => new AbortController().signal;
const user = (account = 'fictional-user') => ({
  stdout: JSON.stringify({ login: account }),
  exitCode: 0,
});
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pitchcrew-github-cli-'));
  runner = vi.fn<GithubCliRunner>();
  fetcher = vi.fn<typeof fetch>();
  manager = new ConnectorManager(directory, fetcher, runner);
  await manager.initialize();
});
afterEach(async () => {
  await manager.close();
  vi.unstubAllEnvs();
  expect(resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-github-cli-'))).toBe(true);
  await rm(directory, { recursive: true, force: true });
});
async function connect() {
  runner
    .mockResolvedValueOnce({ stdout: 'gh version fixture', exitCode: 0 })
    .mockResolvedValueOnce(user());
  return manager.connectGithub({ mode: 'cli' });
}

it('connects an existing CLI login and persists only account metadata', async () => {
  expect(manager.status()[0].connected).toBe(false);
  expect(runner).not.toHaveBeenCalled();
  const status = await connect();
  expect(status[0]).toMatchObject({
    connected: true,
    account: 'fictional-user',
    connectionMethod: 'cli',
    githubCliState: 'ready',
  });
  expect(runner.mock.calls.map(([args]) => args)).toEqual([
    ['--version'],
    ['api', '--hostname', 'github.com', '--method', 'GET', 'user'],
  ]);
  expect(fetcher).not.toHaveBeenCalled();
  const saved = JSON.parse(await readFile(join(directory, 'connectors/credentials.json'), 'utf8'));
  expect(saved).toEqual({ version: 1, github: { mode: 'cli', account: 'fictional-user' } });
  const restarted = new ConnectorManager(directory, fetcher, runner);
  await restarted.initialize();
  expect(restarted.status()[0]).toMatchObject({ connected: true, connectionMethod: 'cli' });
  await restarted.close();
  manager.status();
  expect(runner).toHaveBeenCalledTimes(2);
});

it('makes bounded fixed GET reads through gh and preserves existing transforms', async () => {
  await connect();
  runner.mockResolvedValueOnce(user()).mockResolvedValueOnce({
    exitCode: 0,
    stdout: JSON.stringify({
      encoding: 'base64',
      content: Buffer.from('Fictional project').toString('base64'),
      path: 'README.md',
    }),
  });
  const result = await manager.call(
    'github_read_file',
    { owner: 'fixture', repo: 'portfolio' },
    signal(),
  );
  expect(result).toMatchObject({
    text: 'Fictional project',
    sourceTrust: expect.stringContaining('untrusted'),
  });
  expect(runner.mock.lastCall?.[0]).toEqual([
    'api',
    '--hostname',
    'github.com',
    '--method',
    'GET',
    '--header',
    'Accept: application/vnd.github+json',
    '--header',
    'X-GitHub-Api-Version: 2022-11-28',
    'repos/fixture/portfolio/contents/README.md',
  ]);
  expect(runner.mock.calls.flatMap(([args]) => args)).not.toContain('token');
  expect(fetcher).not.toHaveBeenCalled();
});

it('keeps pagination and treats filename metacharacters as literal arguments', async () => {
  await connect();
  runner.mockResolvedValueOnce(user()).mockResolvedValueOnce({ stdout: '[]', exitCode: 0 });
  await manager.call('github_list_repositories', { page: 3, limit: 5 }, signal());
  expect(runner.mock.lastCall?.[0].at(-1)).toBe('user/repos?page=3&per_page=5&sort=updated');
  runner.mockResolvedValueOnce(user()).mockResolvedValueOnce({ stdout: '[]', exitCode: 0 });
  await manager.call(
    'github_read_file',
    { owner: 'fixture', repo: 'portfolio', path: 'notes; echo secret.md' },
    signal(),
  );
  expect(runner.mock.lastCall?.[0].at(-1)).toBe(
    'repos/fixture/portfolio/contents/notes%3B%20echo%20secret.md',
  );
});

it('shows install guidance when gh is missing and permits retry', async () => {
  runner.mockRejectedValueOnce(new GithubCliMissingError());
  await expect(manager.connectGithub({ mode: 'cli' })).rejects.toThrow('Install GitHub CLI');
  expect(manager.status()[0]).toMatchObject({
    connected: false,
    pending: false,
    githubCliState: 'missing',
  });
  expect(runner).toHaveBeenCalledTimes(1);
  await connect();
  expect(manager.status()[0]).toMatchObject({
    connected: true,
    error: '',
    githubCliState: 'ready',
  });
});

it('shows login guidance without exposing CLI error output', async () => {
  runner
    .mockResolvedValueOnce({ stdout: 'gh fixture', exitCode: 0 })
    .mockResolvedValueOnce({ stdout: 'fictional-sensitive-token', exitCode: 1 });
  await expect(manager.connectGithub({ mode: 'cli' })).rejects.toThrow('gh auth login');
  expect(manager.status()[0]).toMatchObject({ connected: false, githubCliState: 'signed_out' });
  expect(JSON.stringify(manager.status())).not.toContain('sensitive');
  await expect(readFile(join(directory, 'connectors/credentials.json'))).rejects.toThrow();
});

it('requires reconnection after the active CLI account changes', async () => {
  await connect();
  runner.mockResolvedValueOnce(user('different-user'));
  await expect(manager.call('github_list_repositories', {}, signal())).rejects.toThrow(
    'account changed',
  );
  expect(runner).toHaveBeenCalledTimes(3);
  expect(manager.status()[0]).toMatchObject({
    account: 'fictional-user',
    githubCliState: 'account_changed',
    error: expect.stringContaining('Reconnect'),
  });
});

it('rejects arbitrary tools and inputs before starting a CLI process', async () => {
  await connect();
  await expect(manager.call('github_post_issue', {}, signal())).rejects.toThrow('not allowed');
  await expect(
    manager.call('github_list_repositories', { method: 'POST' }, signal()),
  ).rejects.toThrow();
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(manager.call('github_list_repositories', {}, cancelled.signal)).rejects.toThrow();
  expect(runner).toHaveBeenCalledTimes(2);
});

it('disconnects only PitchCrew and never logs the CLI out', async () => {
  await connect();
  await manager.disconnect('github');
  expect(manager.status()[0].connected).toBe(false);
  expect(runner).toHaveBeenCalledTimes(2);
  expect(await readFile(join(directory, 'connectors/credentials.json'), 'utf8')).not.toContain(
    'fictional-user',
  );
  await expect(manager.call('github_list_repositories', {}, signal())).rejects.toThrow(
    'Connect GitHub',
  );
});

it('does not reconnect when disconnect races account validation', async () => {
  runner.mockResolvedValueOnce({ stdout: 'gh fixture', exitCode: 0 });
  let complete!: (result: Awaited<ReturnType<GithubCliRunner>>) => void;
  runner.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const connection = manager.connectGithub({ mode: 'cli' });
  const rejected = expect(connection).rejects.toThrow();
  await vi.waitFor(() => expect(runner).toHaveBeenCalledTimes(2));
  await manager.disconnect('github');
  complete(user());
  await rejected;
  expect(manager.status()[0]).toMatchObject({ connected: false, pending: false });
  expect(await readFile(join(directory, 'connectors/credentials.json'), 'utf8')).not.toContain(
    'fictional-user',
  );
});

it('cancels a CLI read when the account disconnects', async () => {
  await connect();
  let complete!: (result: Awaited<ReturnType<GithubCliRunner>>) => void;
  runner.mockImplementationOnce(
    (_args, active) =>
      new Promise((resolve) => {
        complete = (value) => {
          expect(active.aborted).toBe(true);
          resolve(value);
        };
      }),
  );
  const call = manager.call('github_list_repositories', {}, signal());
  const rejected = expect(call).rejects.toThrow();
  await manager.disconnect('github');
  complete(user());
  await rejected;
  expect(runner).toHaveBeenCalledTimes(3);
});

it('bounds transformed output and sanitizes malformed CLI JSON', async () => {
  await connect();
  runner
    .mockResolvedValueOnce(user())
    .mockResolvedValueOnce({ stdout: JSON.stringify({ login: 'x'.repeat(80001) }), exitCode: 0 });
  await expect(
    manager.call('github_get_profile', { username: 'fixture' }, signal()),
  ).rejects.toThrow('Too much content');
  runner
    .mockResolvedValueOnce(user())
    .mockResolvedValueOnce({ stdout: 'fictional-sensitive-token', exitCode: 0 });
  await expect(
    manager.call('github_get_profile', { username: 'fixture' }, signal()),
  ).rejects.toThrow('invalid response');
  expect(manager.status()[0].error).not.toContain('sensitive');
});

const fixture = fileURLToPath(new URL('./fixtures/github-cli.mjs', import.meta.url));
it('uses native process arguments without a shell and suppresses interactive/debug output', async () => {
  vi.stubEnv('GH_DEBUG', 'api');
  const result = await createGithubCliRunner(process.execPath, [fixture, 'inspect'])(
    ['literal; echo secret', '$HOME'],
    signal(),
  );
  expect(JSON.parse(result.stdout)).toEqual({
    args: ['literal; echo secret', '$HOME'],
    interactive: '1',
    debug: null,
  });
});
it('bounds actual subprocess output', async () => {
  await expect(
    createGithubCliRunner(process.execPath, [fixture, 'oversize'])([], signal()),
  ).rejects.toThrow('too large');
});
it('terminates an actual subprocess on cancellation', async () => {
  const controller = new AbortController();
  const process = createGithubCliRunner(globalThis.process.execPath, [fixture, 'wait'])(
    [],
    controller.signal,
  );
  const rejected = expect(process).rejects.toThrow('cancelled');
  controller.abort();
  await rejected;
});
it('does not return raw stderr from actual subprocesses', async () => {
  const result = await createGithubCliRunner(process.execPath, [fixture, 'error'])([], signal());
  expect(result).toEqual({ stdout: '', exitCode: 1 });
});
