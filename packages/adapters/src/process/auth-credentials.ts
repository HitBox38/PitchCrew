import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { runtimeConnectionDirectory } from './runtime-connection.ts';

const credentialLimit = 64 * 1024;
interface CredentialFile {
  bytes: Buffer;
  digest: string;
}
interface Waiter {
  signal?: AbortSignal;
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
  abort: () => void;
}
interface CredentialLock {
  active: boolean;
  waiters: Waiter[];
}
const locks = new Map<string, CredentialLock>();
const cancelled = () => new Error('Run cancelled while waiting for native authentication.');
const failure = () =>
  new Error('The workspace Grok sign-in cannot be read safely. Sign out and sign in again.');
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

const enter = (key: string, signal?: AbortSignal): Promise<() => void> => {
  if (signal?.aborted) return Promise.reject(cancelled());
  const lock = locks.get(key) ?? { active: false, waiters: [] };
  locks.set(key, lock);
  const release = () => {
    const next = lock.waiters.shift();
    if (next) {
      next.signal?.removeEventListener('abort', next.abort);
      next.resolve(release);
    } else {
      lock.active = false;
      locks.delete(key);
    }
  };
  if (!lock.active) {
    lock.active = true;
    return Promise.resolve(release);
  }
  return new Promise((resolveWaiter, reject) => {
    const waiter: Waiter = {
      signal,
      resolve: resolveWaiter,
      reject,
      abort: () => {
        const index = lock.waiters.indexOf(waiter);
        if (index >= 0) lock.waiters.splice(index, 1);
        reject(cancelled());
      },
    };
    lock.waiters.push(waiter);
    signal?.addEventListener('abort', waiter.abort, { once: true });
  });
};

/** Abortable serialization for native refresh tokens; no credentials cross this interface. */
export const withNativeCredentialLease = async <T>(
  key: string,
  signal: AbortSignal | undefined,
  action: () => Promise<T>,
): Promise<T> => {
  const release = await enter(process.platform === 'win32' ? key.toLowerCase() : key, signal);
  try {
    signal?.throwIfAborted();
    return await action();
  } finally {
    release();
  }
};

/** Only the server-owned workspace auth home is eligible; ambient user files are never read. */
const privateBase = async (create: boolean): Promise<string | undefined> => {
  const configured = runtimeConnectionDirectory();
  if (!configured) return undefined;
  if (
    !isAbsolute(configured) ||
    basename(configured) !== 'grok' ||
    basename(dirname(configured)) !== 'runtime-auth'
  )
    throw failure();
  try {
    const parent = dirname(configured);
    if (create) await mkdir(parent, { recursive: true, mode: 0o700 });
    const parentInfo = await lstat(parent);
    if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) throw failure();
    if (create) await mkdir(configured, { recursive: true, mode: 0o700 });
    const info = await lstat(configured);
    if (!info.isDirectory() || info.isSymbolicLink()) throw failure();
    const parentReal = await realpath(parent),
      actual = await realpath(configured);
    if (dirname(actual) !== parentReal) throw failure();
    if (create) {
      await chmod(parent, 0o700);
      await chmod(configured, 0o700);
    }
    return actual;
  } catch (error) {
    if (!create && error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return undefined;
    throw failure();
  }
};

const readCredentials = async (base: string): Promise<CredentialFile | undefined> => {
  const path = join(base, 'auth.json');
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const before = await lstat(path);
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.size > credentialLimit
    )
      throw failure();
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.nlink !== 1 ||
      opened.ino !== before.ino ||
      opened.dev !== before.dev ||
      opened.size > credentialLimit
    )
      throw failure();
    await handle.chmod(0o600);
    const buffer = Buffer.alloc(credentialLimit + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > credentialLimit) throw failure();
    const bytes = buffer.subarray(0, bytesRead);
    const value: unknown = JSON.parse(bytes.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw failure();
    if (!Object.keys(value).length) return undefined;
    if (
      Object.values(value).some(
        (entry) => !entry || typeof entry !== 'object' || Array.isArray(entry),
      )
    )
      throw failure();
    return { bytes, digest: digest(bytes) };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw failure();
  } finally {
    await handle?.close();
  }
};

export const workspaceGrokCredentialState = async (): Promise<
  'missing' | 'present' | 'invalid'
> => {
  try {
    const base = await privateBase(false);
    return base && (await readCredentials(base)) ? 'present' : 'missing';
  } catch {
    return 'invalid';
  }
};

const assertOwnedHome = async (base: string, home: string) => {
  const currentBase = await realpath(base),
    current = await realpath(home);
  const info = await lstat(home);
  if (
    currentBase !== base ||
    current !== resolve(home) ||
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    dirname(current) !== currentBase ||
    !basename(current).startsWith('.run-') ||
    !current.startsWith(currentBase + sep)
  )
    throw failure();
  return current;
};
const cleanOwnedHome = async (base: string, home: string) => {
  const current = await assertOwnedHome(base, home);
  await rm(current, { recursive: true, force: true });
};

const persistRefresh = async (base: string, home: string, original: CredentialFile) => {
  if ((await privateBase(false)) !== base) throw failure();
  await assertOwnedHome(base, home);
  const refreshed = await readCredentials(home);
  if (!refreshed || refreshed.digest === original.digest) return;
  const current = await readCredentials(base);
  if (current?.digest !== original.digest) return;
  const temporary = join(base, `.auth-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, refreshed.bytes, { mode: 0o600, flag: 'wx' });
    await chmod(temporary, 0o600);
    // A login/logout outside this owned run must win over its old refreshed copy.
    if ((await readCredentials(base))?.digest === original.digest)
      await rename(temporary, join(base, 'auth.json'));
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
};

const safeActionFailure = (
  error: unknown,
  ...credentials: Array<CredentialFile | undefined>
): Error => {
  let message = error instanceof Error ? error.message : 'Grok did not complete its operation.';
  for (const credential of credentials)
    if (credential) {
      const redact = (value: unknown, name = ''): void => {
        if (
          typeof value === 'string' &&
          value &&
          (value.length >= 4 || /key|token|secret|password|credential/i.test(name))
        )
          message = message.replaceAll(value, '[redacted]');
        else if (value && typeof value === 'object')
          Object.entries(value).forEach(([key, child]) => redact(child, key));
      };
      redact(JSON.parse(credential.bytes.toString('utf8')));
    }
  return Object.assign(
    new Error(message),
    error instanceof Error && 'code' in error
      ? {
          code: error.code,
          ...('exitCode' in error && typeof error.exitCode === 'number'
            ? { exitCode: error.exitCode }
            : {}),
          ...('signal' in error && typeof error.signal === 'string'
            ? { signal: error.signal }
            : {}),
        }
      : {},
  );
};

const isolatedModelRead = async <T>(action: (home: string) => Promise<T>): Promise<T> => {
  const base = await realpath(tmpdir()),
    home = await mkdtemp(join(base, '.run-grok-models-'));
  let result: T | undefined, error: unknown;
  try {
    await chmod(home, 0o700);
    result = await action(home);
  } catch (failure) {
    error = failure instanceof Error ? failure : new Error('Grok model discovery failed.');
  }
  try {
    await cleanOwnedHome(base, home);
  } catch {
    error ??= new Error('The private Grok model discovery folder could not be cleaned up.');
  }
  if (error) throw error;
  return result as T;
};

/**
 * Grok refreshes native auth.json. OAuth-backed operations serialize and use a disposable
 * private home containing only that file plus caller-generated scoped config. API-key runs
 * retain their existing independent run homes. Credentials never enter a job run folder.
 */
export const withWorkspaceGrokCredentials = async <T>(
  fallbackHome: string | undefined,
  signal: AbortSignal | undefined,
  action: (home: string | undefined) => Promise<T>,
): Promise<T> => {
  signal?.throwIfAborted();
  const configured = runtimeConnectionDirectory();
  if (!configured) return fallbackHome ? action(fallbackHome) : isolatedModelRead(action);
  const base = await privateBase(!fallbackHome);
  const candidate = base ? await readCredentials(base) : undefined;
  if (!candidate && fallbackHome) return action(fallbackHome);
  if (!base) return action(fallbackHome);
  const execute = async (): Promise<T> => {
    signal?.throwIfAborted();
    if ((await privateBase(false)) !== base) throw failure();
    const original = candidate ? await readCredentials(base) : undefined;
    if (!original && fallbackHome) return await action(fallbackHome);
    const home = await mkdtemp(join(base, '.run-'));
    let result: T | undefined, actionFailure: Error | undefined;
    try {
      await chmod(home, 0o700);
      if (original)
        await writeFile(join(home, 'auth.json'), original.bytes, { mode: 0o600, flag: 'wx' });
      signal?.throwIfAborted();
      try {
        result = await action(home);
      } catch (error) {
        let refreshed: CredentialFile | undefined;
        try {
          await assertOwnedHome(base, home);
          refreshed = await readCredentials(home);
        } catch {
          /* A failed file read is reported below; credential data never enters diagnostics. */
        }
        actionFailure = safeActionFailure(error, original, refreshed);
      }
    } catch {
      actionFailure = signal?.aborted ? cancelled() : failure();
    }
    try {
      if (original) await persistRefresh(base, home, original);
    } catch {
      actionFailure ??= new Error(
        'Grok finished, but its refreshed sign-in could not be saved. Sign in again before continuing.',
      );
    }
    try {
      await cleanOwnedHome(base, resolve(home));
    } catch {
      actionFailure ??= new Error(
        'The private Grok operation folder could not be cleaned up. Check workspace storage before continuing.',
      );
    }
    if (actionFailure) throw actionFailure;
    return result as T;
  };
  return candidate ? withNativeCredentialLease(base, signal, execute) : execute();
};
