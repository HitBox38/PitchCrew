import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, isAbsolute, join, resolve } from 'node:path';

const folderPrefix = 'pitchcrew-remote-tunnel-';
const startupLimit = 45_000;
const originPattern = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com\/?$/i;

export interface RemoteTunnel {
  origin: URL;
  close: () => Promise<void>;
  closed: Promise<void>;
}

export const findTunnelExecutable = async (): Promise<string | null> => {
  const name = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  for (const directory of (process.env.PATH ?? '').split(delimiter).filter(isAbsolute)) {
    const file = join(directory, name);
    try {
      await access(file, constants.X_OK);
      if ((await stat(file)).isFile()) return file;
    } catch {
      // Missing PATH entries are normal.
    }
  }
  return null;
};

const tunnelEnvironment = () => {
  const allowed =
    /^(?:PATH|SYSTEMROOT|WINDIR|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMDATA|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|SSL_CERT_FILE|SSL_CERT_DIR)$/i;
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.test(key)));
};

const removeFolder = async (directory: string) => {
  if (dirname(directory) !== resolve(tmpdir()) || !basename(directory).startsWith(folderPrefix))
    throw new Error('Refusing unsafe tunnel configuration cleanup.');
  await rm(directory, { recursive: true, force: true });
};

export const openRemoteTunnel = async (
  target: URL,
  signal: AbortSignal,
  executable?: string,
): Promise<RemoteTunnel> => {
  if (
    target.protocol !== 'http:' ||
    target.hostname !== '127.0.0.1' ||
    !target.port ||
    Number(target.port) < 1024 ||
    target.username ||
    target.password ||
    target.pathname !== '/' ||
    target.href.includes('?') ||
    target.href.includes('#')
  )
    throw new Error('The remote tunnel target must be a plain HTTP loopback server.');
  signal.throwIfAborted();
  const command = executable ?? (await findTunnelExecutable());
  if (!command || !isAbsolute(command))
    throw new Error(
      'Install cloudflared and make it available on PATH before connecting remote apps.',
    );
  const directory = resolve(await mkdtemp(join(tmpdir(), folderPrefix)));
  try {
    const config = join(directory, 'config.yml');
    await writeFile(config, '{}\n', { mode: 0o600, flag: 'wx' });
    signal.throwIfAborted();
    const child = spawn(
      command,
      [
        'tunnel',
        '--config',
        config,
        '--no-autoupdate',
        '--url',
        target.href,
        '--http-host-header',
        target.host,
        '--metrics',
        '127.0.0.1:0',
        '--loglevel',
        'info',
        '--grace-period',
        '1s',
      ],
      {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: tunnelEnvironment(),
      },
    );
    let finishClosed!: () => void;
    let failClosed!: (error: unknown) => void;
    const closed = new Promise<void>((resolve, reject) => {
      finishClosed = resolve;
      failClosed = reject;
    });
    // A failed cleanup is also reported by close(); avoid an unhandled rejection during startup.
    void closed.catch(() => {});
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    let stopping = false;
    const close = () => {
      if (!stopping && child.exitCode === null && child.signalCode === null) {
        stopping = true;
        child.kill('SIGTERM');
        stopTimer = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        }, 2000);
        stopTimer.unref();
      }
      return closed;
    };
    return await new Promise<RemoteTunnel>((resolveReady, rejectReady) => {
      let ready = false;
      let failed = false;
      let outputBytes = 0;
      const buffers = ['', ''];
      const timer = setTimeout(
        () => fail('The temporary connection timed out. Check your network and try again.'),
        startupLimit,
      );
      const fail = (message: string) => {
        if (ready || failed) return;
        failed = true;
        clearTimeout(timer);
        void close().then(() => rejectReady(new Error(message)), rejectReady);
      };
      const onAbort = () => {
        if (ready) void close();
        else fail('The temporary connection was cancelled.');
      };
      const onData = (index: number, chunk: Buffer) => {
        if (ready || failed) return;
        outputBytes += chunk.length;
        if (outputBytes > 32_768)
          return fail('cloudflared produced too much output before connecting.');
        buffers[index] += chunk.toString('utf8');
        const lines = buffers[index].split('\n');
        buffers[index] = lines.pop()!;
        if (buffers[index].length > 4096 || lines.some((line) => line.length > 4096))
          return fail('cloudflared produced an oversized connection message.');
        for (const line of lines) {
          const candidate = line
            .match(/https:\/\/[^\s<>"'|]+/g)
            ?.find((url) => originPattern.test(url));
          if (!candidate) continue;
          ready = true;
          clearTimeout(timer);
          buffers[0] = buffers[1] = '';
          resolveReady({ origin: new URL(candidate), close, closed });
          return;
        }
      };
      child.stdout.on('data', (chunk: Buffer) => onData(0, chunk));
      child.stderr.on('data', (chunk: Buffer) => onData(1, chunk));
      const onError = () =>
        fail('Could not start cloudflared. Check its installation and try again.');
      child.once('error', onError);
      child.once('close', () => {
        clearTimeout(timer);
        clearTimeout(stopTimer);
        signal.removeEventListener('abort', onAbort);
        child.removeListener('error', onError);
        child.stdout.removeAllListeners('data');
        child.stderr.removeAllListeners('data');
        if (!ready && !failed) {
          failed = true;
          void closed.then(
            () => rejectReady(new Error('cloudflared stopped before creating a connection.')),
            rejectReady,
          );
        }
        void removeFolder(directory).then(finishClosed, failClosed);
      });
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
  } catch (error) {
    await removeFolder(directory);
    throw error;
  }
};
