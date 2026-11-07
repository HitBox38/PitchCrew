import { afterEach, expect, test, vi } from 'vitest';
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { withRuntimeConnection } from '../src/process/runtime-connection.ts';
import {
  withNativeCredentialLease,
  withWorkspaceGrokCredentials,
  workspaceGrokCredentialState,
} from '../src/process/auth-credentials.ts';
import { checkRuntimeAuthentication } from '../src/maintenance/authentication.ts';
import { grok } from '../src/grok/index.ts';
import { runCliText } from '../src/process.ts';
import { contextFor, cleanup } from './helpers/runtime.ts';

const roots: string[] = [];
const credentials = (key: string) =>
  JSON.stringify({ 'https://accounts.x.ai/sign-in': { auth_mode: 'session_token', key } });
const fixture = async (signedIn = true) => {
  const root = await mkdtemp(join(tmpdir(), 'pitchcrew-grok-credentials-'));
  roots.push(root);
  const base = join(root, 'runtime-auth', 'grok'),
    fallback = join(root, 'runs', 'fixture-job', 'grok-home');
  await mkdir(base, { recursive: true, mode: 0o700 });
  if (signedIn)
    await writeFile(join(base, 'auth.json'), credentials('fictional-original-token'), {
      mode: 0o600,
    });
  const scoped = <T>(action: () => T) => withRuntimeConnection('grok', {}, action, base);
  return { root, base, fallback, scoped };
};
const deferred = () => {
  let resolvePromise!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};
afterEach(async () => {
  vi.restoreAllMocks();
  await cleanup();
  for (const root of roots.splice(0)) {
    if (
      dirname(resolve(root)) !== resolve(tmpdir()) ||
      !basename(root).startsWith('pitchcrew-grok-credentials-')
    )
      throw new Error('Unsafe Grok fixture cleanup path.');
    await rm(root, { recursive: true, force: true });
  }
});

test('binds only workspace auth.json outside job run folders and saves native token rotation before cleanup', async () => {
  const { base, fallback, scoped } = await fixture();
  await writeFile(join(base, 'config.toml'), 'foreign-config = true');
  await mkdir(join(base, 'plugins'));
  await writeFile(join(base, 'plugins', 'foreign-plugin.js'), 'foreign');
  let operationHome = '';
  const result = await scoped(() =>
    withWorkspaceGrokCredentials(fallback, undefined, async (home) => {
      operationHome = home!;
      expect(dirname(home!)).toBe(base);
      expect(home).not.toContain(join('runs', 'fixture-job'));
      expect(await readdir(home!)).toEqual(['auth.json']);
      expect(await readFile(join(home!, 'auth.json'), 'utf8')).toBe(
        credentials('fictional-original-token'),
      );
      await writeFile(join(home!, 'config.toml'), 'generated-scoped-config = true', {
        mode: 0o600,
      });
      await writeFile(join(home!, 'auth.json'), credentials('fictional-rotated-token'), {
        mode: 0o600,
      });
      return 'fictional completed run';
    }),
  );
  expect(result).toBe('fictional completed run');
  expect(await readFile(join(base, 'auth.json'), 'utf8')).toBe(
    credentials('fictional-rotated-token'),
  );
  expect(await readFile(join(base, 'config.toml'), 'utf8')).toBe('foreign-config = true');
  await expect(stat(operationHome)).rejects.toMatchObject({ code: 'ENOENT' });
  await expect(stat(fallback)).rejects.toMatchObject({ code: 'ENOENT' });
  if (process.platform !== 'win32')
    expect((await stat(join(base, 'auth.json'))).mode & 0o777).toBe(0o600);
});

test.each(['replace', 'remove'] as const)(
  'does not overwrite an intervening external %s of the persistent sign-in',
  async (change) => {
    const { base, fallback, scoped } = await fixture();
    await scoped(() =>
      withWorkspaceGrokCredentials(fallback, undefined, async (home) => {
        await writeFile(join(home!, 'auth.json'), credentials('fictional-old-run-refresh'));
        if (change === 'replace')
          await writeFile(join(base, 'auth.json'), credentials('fictional-new-login'));
        else await rm(join(base, 'auth.json'));
      }),
    );
    if (change === 'replace')
      expect(await readFile(join(base, 'auth.json'), 'utf8')).toBe(
        credentials('fictional-new-login'),
      );
    else await expect(stat(join(base, 'auth.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await readdir(base)).filter((name) => name.startsWith('.run-'))).toEqual([]);
  },
);

test('serializes native refresh-token operations and cancels queued admission without starting it', async () => {
  const firstEntered = deferred(),
    releaseFirst = deferred();
  const order: string[] = [];
  const first = withNativeCredentialLease('fictional-lease', undefined, async () => {
    order.push('first');
    firstEntered.resolve();
    await releaseFirst.promise;
    order.push('first finished');
  });
  await firstEntered.promise;
  const controller = new AbortController();
  const waiting = withNativeCredentialLease('fictional-lease', controller.signal, async () => {
    order.push('cancelled waiter');
  });
  const rejected = expect(waiting).rejects.toThrow('Run cancelled');
  const next = withNativeCredentialLease('fictional-lease', undefined, async () => {
    order.push('next');
  });
  controller.abort();
  await rejected;
  expect(order).toEqual(['first']);
  releaseFirst.resolve();
  await Promise.all([first, next]);
  expect(order).toEqual(['first', 'first finished', 'next']);
});

test('keeps API-key-only runs parallel and does not create credential copies', async () => {
  const { fallback, scoped, base } = await fixture(false);
  const enteredA = deferred(),
    enteredB = deferred(),
    release = deferred();
  const operation = (home: string, entered: ReturnType<typeof deferred>) =>
    scoped(() =>
      withWorkspaceGrokCredentials(home, undefined, async (actual) => {
        expect(actual).toBe(home);
        entered.resolve();
        await release.promise;
      }),
    );
  const first = operation(fallback, enteredA),
    second = operation(`${fallback}-second`, enteredB);
  await Promise.all([enteredA.promise, enteredB.promise]);
  expect(await readdir(base)).toEqual([]);
  release.resolve();
  await Promise.all([first, second]);
});

test('persists a refresh and removes the operation home when an owned process is cancelled', async () => {
  const { base, fallback, scoped } = await fixture();
  let operationHome = '';
  await expect(
    scoped(() =>
      withWorkspaceGrokCredentials(fallback, undefined, async (home) => {
        operationHome = home!;
        await writeFile(join(home!, 'auth.json'), credentials('fictional-cancelled-refresh'));
        throw new Error('Run cancelled.');
      }),
    ),
  ).rejects.toThrow('Run cancelled');
  expect(await readFile(join(base, 'auth.json'), 'utf8')).toBe(
    credentials('fictional-cancelled-refresh'),
  );
  await expect(stat(operationHome)).rejects.toMatchObject({ code: 'ENOENT' });
  await expect(
    scoped(() => withWorkspaceGrokCredentials(fallback, undefined, async () => 'next')),
  ).resolves.toBe('next');
});

test('preserves the primary run failure when refresh persistence also fails and redacts native credentials', async () => {
  const { base, fallback, scoped } = await fixture();
  await expect(
    scoped(() =>
      withWorkspaceGrokCredentials(fallback, undefined, async (home) => {
        await writeFile(join(home!, 'auth.json'), credentials('fictional-refresh'));
        await writeFile(join(base, 'auth.json'), 'fictional malformed storage');
        throw Object.assign(new Error('Run failed using fictional-original-token'), {
          code: 'FIXTURE_RUN_FAILURE',
        });
      }),
    ),
  ).rejects.toMatchObject({ message: 'Run failed using [redacted]', code: 'FIXTURE_RUN_FAILURE' });
  expect((await readdir(base)).filter((name) => name.startsWith('.run-'))).toEqual([]);
});

test('redacts tokens rotated by the native process before reporting a failed run', async () => {
  const { base, fallback, scoped } = await fixture();
  await expect(
    scoped(() =>
      withWorkspaceGrokCredentials(fallback, undefined, async (home) => {
        await writeFile(join(home!, 'auth.json'), credentials('fictional-new-token'));
        throw new Error('Native error fictional-new-token with old fictional-original-token');
      }),
    ),
  ).rejects.toThrow('Native error [redacted] with old [redacted]');
  expect(await readFile(join(base, 'auth.json'), 'utf8')).toBe(credentials('fictional-new-token'));
});

test.each(['malformed', 'oversized', 'redirected', 'hardlinked'] as const)(
  'rejects %s private authentication files without importing ambient credentials',
  async (kind) => {
    const { root, base, fallback, scoped } = await fixture(false);
    vi.stubEnv('GROK_HOME', root);
    await writeFile(join(root, 'auth.json'), credentials('fictional-ambient-token'));
    if (kind === 'malformed') await writeFile(join(base, 'auth.json'), '{fictional broken JSON');
    else if (kind === 'oversized')
      await writeFile(join(base, 'auth.json'), 'x'.repeat(64 * 1024 + 1));
    else if (kind === 'hardlinked') await link(join(root, 'auth.json'), join(base, 'auth.json'));
    else {
      await rm(base, { recursive: true });
      const redirected = join(root, 'redirected');
      await mkdir(redirected);
      await symlink(redirected, base, process.platform === 'win32' ? 'junction' : 'dir');
    }
    expect(await scoped(() => workspaceGrokCredentialState())).toBe('invalid');
    const launch = vi.fn(async () => {});
    await expect(
      scoped(() => withWorkspaceGrokCredentials(fallback, undefined, launch)),
    ).rejects.toThrow('workspace Grok sign-in');
    expect(launch).not.toHaveBeenCalled();
    expect(await readFile(join(root, 'auth.json'), 'utf8')).toBe(
      credentials('fictional-ambient-token'),
    );
  },
);

test('reports private native credential presence as unverified rather than missing an API key', async () => {
  const { scoped, base } = await fixture();
  vi.stubEnv('XAI_API_KEY', '');
  const result = await scoped(() => checkRuntimeAuthentication({ runtime: 'grok', model: '' }));
  expect(result.status).toBe('unknown');
  expect(result.detail).toContain('native Grok credentials are present');
  expect(JSON.stringify(result)).not.toContain('fictional-original-token');
  await rm(join(base, 'auth.json'));
  expect(
    (await scoped(() => checkRuntimeAuthentication({ runtime: 'grok', model: '' }))).status,
  ).toBe('missing');
});

test('uses an empty disposable model-discovery home when no workspace credential scope exists', async () => {
  const { root } = await fixture();
  vi.stubEnv('GROK_HOME', root);
  await writeFile(join(root, 'auth.json'), credentials('fictional-global-token'));
  let temporary = '';
  await withWorkspaceGrokCredentials(undefined, undefined, async (home) => {
    temporary = home!;
    expect(home).not.toBe(root);
    expect(await readdir(home!)).toEqual([]);
  });
  await expect(stat(temporary)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readFile(join(root, 'auth.json'), 'utf8')).toBe(
    credentials('fictional-global-token'),
  );
});

test('keeps the Grok tool and configuration boundary while using a private OAuth run home', async () => {
  const { scoped, base } = await fixture();
  const context = await contextFor('grok');
  let operationHome = '';
  vi.mocked(runCliText).mockImplementationOnce(
    async (_command, args, actualContext, _prompt, _extract, environment) => {
      operationHome = environment!.GROK_HOME!;
      expect(dirname(operationHome)).toBe(base);
      expect(operationHome.startsWith(context.directory)).toBe(false);
      expect(actualContext.mcp).toEqual(context.mcp);
      expect(args[args.indexOf('--tools') + 1]).toBe('GrokBuild:search_tool,GrokBuild:use_tool');
      expect(args[args.indexOf('--allow') + 1]).toBe('MCPTool(pitchcrew__*)');
      expect(args[args.indexOf('--deny') + 1]).toBe('Read(**)');
      expect(environment!.GROK_AUTH).toBeUndefined();
      const config = await readFile(join(operationHome, 'config.toml'), 'utf8');
      expect(config).toContain('imported = true');
      expect(config).toContain('load_envrc = false');
      expect(config).toContain('[mcp_servers.pitchcrew]');
      expect(await readFile(join(operationHome, 'auth.json'), 'utf8')).toBe(
        credentials('fictional-original-token'),
      );
      return JSON.stringify({ role: 'scout', fit: 87, reasons: ['Fixture result'] });
    },
  );
  expect(await scoped(() => grok.run(context))).toMatchObject({ role: 'scout', fit: 87 });
  await expect(stat(operationHome)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readdir(context.directory)).not.toContain('auth.json');
});

test('keeps shared execution deadlines while waiting for native credentials and starts no expired run', async () => {
  const { scoped } = await fixture();
  const context = await contextFor('grok');
  context.deadline = { expiresAt: Date.now() - 1 };
  vi.mocked(runCliText).mockClear();
  await expect(scoped(() => grok.run(context))).rejects.toMatchObject({ code: 'ETIMEDOUT' });
  expect(runCliText).not.toHaveBeenCalled();
});

vi.mock('../src/process.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/process.ts')>();
  return { ...original, runCliText: vi.fn() };
});
