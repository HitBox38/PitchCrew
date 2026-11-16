import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConnectorManager } from '../src/connectors/manager.ts';
import type { GithubCliRunner } from '../src/connectors/auth/github-cli-process.ts';

let directory: string;
let manager: ConnectorManager;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
let runner: ReturnType<typeof vi.fn<GithubCliRunner>>;
const old = 'a'.repeat(40);
const next = 'b'.repeat(40);
const commit = 'c'.repeat(40);
const input = {
  repository: 'fictional/profile',
  branch: 'main',
  path: 'notes/experience.md',
  content: '# Fictional experience\n\nBuilt an Atlas tool.',
  expectedSha: old,
  message: 'Update profile note',
};
const signal = () => new AbortController().signal;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const cli = (data: unknown, status = 200) => ({
  stdout: `HTTP/2.0 ${status} Fixture\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}`,
  exitCode: status >= 400 ? 1 : 0,
});
const connectToken = async () => {
  fetcher.mockResolvedValueOnce(json({ login: 'fictional-user' }));
  await manager.connectGithub({ token: 'fictional-private-token' });
};
const preflight = (current: unknown = { type: 'file', sha: old }) => {
  fetcher.mockResolvedValueOnce(json({ name: 'main', commit: { sha: old } }));
  fetcher.mockResolvedValueOnce(json(current, current === null ? 404 : 200));
};
const saved = { content: { sha: next }, commit: { sha: commit } };
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pitchcrew-github-profile-'));
  fetcher = vi.fn<typeof fetch>();
  runner = vi.fn<GithubCliRunner>();
  manager = new ConnectorManager(directory, fetcher, runner);
  await manager.initialize();
});
afterEach(async () => {
  await manager.close();
  expect(resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-github-profile-'))).toBe(true);
  await rm(directory, { recursive: true, force: true });
});

it('writes an exact source file with its expected blob revision and checks authorization immediately before committing', async () => {
  await connectToken();
  preflight();
  const authorize = vi.fn(async () => {
    expect(fetcher).toHaveBeenCalledTimes(3);
    fetcher.mockResolvedValueOnce(json(saved));
  });
  expect(await manager.writeProfileGithub(input, signal(), authorize)).toEqual({
    sha: next,
    commit,
    branch: 'main',
    url: `https://github.com/fictional/profile/blob/${commit}/notes/experience.md`,
  });
  expect(authorize).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.lastCall!;
  expect(String(url)).toBe(
    'https://api.github.com/repos/fictional/profile/contents/notes/experience.md',
  );
  expect(init).toMatchObject({ method: 'PUT', redirect: 'error' });
  expect(JSON.parse(String(init?.body))).toEqual({
    branch: 'main',
    message: input.message,
    sha: old,
    content: Buffer.from(input.content).toString('base64'),
  });
});

it('resolves the default branch and creates only a missing file', async () => {
  await connectToken();
  fetcher.mockResolvedValueOnce(json({ default_branch: 'main' }));
  preflight(null);
  fetcher.mockResolvedValueOnce(json(saved, 201));
  await manager.writeProfileGithub({ ...input, branch: undefined, expectedSha: null }, signal());
  expect(JSON.parse(String(fetcher.mock.lastCall?.[1]?.body))).not.toHaveProperty('sha');
});

it('deletes only the expected revision and returns a null file revision', async () => {
  await connectToken();
  preflight();
  fetcher.mockResolvedValueOnce(json({ content: null, commit: { sha: commit } }));
  expect(await manager.writeProfileGithub({ ...input, content: null }, signal())).toMatchObject({
    sha: null,
    commit,
  });
  expect(fetcher.mock.lastCall?.[1]?.method).toBe('DELETE');
  expect(JSON.parse(String(fetcher.mock.lastCall?.[1]?.body))).toEqual({
    branch: 'main',
    sha: old,
    message: input.message,
  });
});

it.each([
  [{ type: 'file', sha: next }, old],
  [{ type: 'file', sha: old }, null],
  [null, old],
])(
  'refuses conflicting remote file revisions without making a mutation',
  async (current, expectedSha) => {
    await connectToken();
    preflight(current);
    await expect(manager.writeProfileGithub({ ...input, expectedSha }, signal())).rejects.toThrow(
      'changed',
    );
    expect(
      fetcher.mock.calls.every(([, init]) => !['PUT', 'DELETE'].includes(String(init?.method))),
    ).toBe(true);
  },
);

it('refuses a tag or commit source and validates paths before contacting GitHub', async () => {
  await connectToken();
  for (const invalid of [
    { path: '../outside.md' },
    { path: '/outside.md' },
    { path: 'notes\\outside.md' },
    { path: '.git/config.md' },
    { path: 'notes/image.png' },
    { repository: 'fictional/..' },
    { branch: 'main\n' },
    { branch: '../main' },
    { content: 'null\0byte' },
  ])
    await expect(manager.writeProfileGithub({ ...input, ...invalid }, signal())).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockResolvedValueOnce(json(null, 404));
  await expect(manager.writeProfileGithub({ ...input, branch: old }, signal())).rejects.toThrow(
    'existing branch',
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('rechecks source authorization and cancellation before mutation', async () => {
  await connectToken();
  preflight();
  await expect(
    manager.writeProfileGithub(input, signal(), async () => {
      throw new Error('Profile source was removed.');
    }),
  ).rejects.toThrow('removed');
  expect(fetcher).toHaveBeenCalledTimes(3);
  preflight();
  const controller = new AbortController();
  await expect(
    manager.writeProfileGithub(input, controller.signal, async () => controller.abort()),
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(5);
});

it('stops on disconnect during preflight', async () => {
  await connectToken();
  fetcher.mockImplementationOnce(async () => {
    await manager.disconnect('github');
    return json({ name: 'main', commit: { sha: old } });
  });
  await expect(manager.writeProfileGithub(input, signal())).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('never retries an uncertain mutation and suppresses provider or transport secrets', async () => {
  await connectToken();
  preflight();
  fetcher.mockRejectedValueOnce(new Error('fictional-private-token'));
  await expect(manager.writeProfileGithub(input, signal())).rejects.toThrow('Inspect the source');
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
  preflight();
  fetcher.mockResolvedValueOnce(json({ message: 'fictional-private-token' }, 403));
  await expect(manager.writeProfileGithub(input, signal())).rejects.toThrow('failed (403)');
});

it('uses the saved CLI account with an explicit method, fixed route and JSON stdin', async () => {
  const user = { stdout: JSON.stringify({ login: 'fictional-user' }), exitCode: 0 };
  runner.mockResolvedValueOnce({ stdout: 'gh fixture', exitCode: 0 }).mockResolvedValueOnce(user);
  await manager.connectGithub({ mode: 'cli' });
  runner
    .mockResolvedValueOnce(user)
    .mockResolvedValueOnce(cli({ name: 'main', commit: { sha: old } }));
  runner.mockResolvedValueOnce(user).mockResolvedValueOnce(cli({ type: 'file', sha: old }));
  runner.mockResolvedValueOnce(user).mockResolvedValueOnce(cli(saved));
  expect(await manager.writeProfileGithub(input, signal())).toMatchObject({ sha: next, commit });
  const [args, , stdin] = runner.mock.lastCall!;
  expect(args).toEqual([
    'api',
    '--hostname',
    'github.com',
    '--method',
    'PUT',
    '--include',
    '--header',
    'Accept: application/vnd.github+json',
    '--header',
    'X-GitHub-Api-Version: 2022-11-28',
    '--input',
    '-',
    'repos/fictional/profile/contents/notes/experience.md',
  ]);
  expect(JSON.parse(stdin!)).toMatchObject({
    sha: old,
    content: Buffer.from(input.content).toString('base64'),
  });
  expect(args.join(' ')).not.toContain('Fictional experience');
  expect(fetcher).not.toHaveBeenCalled();
});

it('recognizes missing files from CLI status headers and refuses changed CLI accounts', async () => {
  const user = { stdout: JSON.stringify({ login: 'fictional-user' }), exitCode: 0 };
  runner.mockResolvedValueOnce({ stdout: 'gh fixture', exitCode: 0 }).mockResolvedValueOnce(user);
  await manager.connectGithub({ mode: 'cli' });
  runner
    .mockResolvedValueOnce(user)
    .mockResolvedValueOnce(cli({ name: 'main', commit: { sha: old } }));
  runner.mockResolvedValueOnce(user).mockResolvedValueOnce(cli({ message: 'not found' }, 404));
  runner.mockResolvedValueOnce({
    stdout: JSON.stringify({ login: 'different-user' }),
    exitCode: 0,
  });
  await expect(
    manager.writeProfileGithub({ ...input, expectedSha: null }, signal()),
  ).rejects.toThrow('account changed');
  expect(runner.mock.calls.filter(([args]) => args.includes('PUT'))).toHaveLength(0);
  expect(manager.status()[0].githubCliState).toBe('account_changed');
});
