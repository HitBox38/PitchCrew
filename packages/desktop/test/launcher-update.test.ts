import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('the actual launcher stops and recovers its daemon over IPC while preserving local files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-launcher-update-'));
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  const saved = join(directory, 'saved-work.txt');
  await writeFile(saved, 'Fictional candidate: saved application notes.');
  const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/packaged-launcher.ts'], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: {
      ...process.env,
      PITCHCREW_HOME: directory,
      PITCHCREW_PORT: String(port),
      PITCHCREW_SEED_SKILLS: '0',
      PITCHCREW_UPDATE_CHECKS: '0',
      PITCHCREW_POSTHOG_DISABLED: '1',
    },
    windowsHide: true,
  });
  let output = '';
  child.stdout?.on('data', (data) => {
    output += String(data);
  });
  child.stderr?.on('data', (data) => {
    output += String(data);
  });
  const receive = () =>
    Promise.race([
      once(child, 'message').then(([message]) => message),
      once(child, 'exit').then(() => {
        throw new Error(`Launcher exited: ${output}`);
      }),
    ]);
  const health = () =>
    fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(500) });
  try {
    expect(await receive()).toMatchObject({ url: `http://127.0.0.1:${port}`, canUpdate: true });
    expect((await health()).ok).toBe(true);
    let response = receive();
    child.send({ action: 'prepare-update', request: 1, version: '0.2.0' });
    expect(await response).toEqual({ request: 1, ok: true });
    await expect(health()).rejects.toThrow();
    expect(await readFile(saved, 'utf8')).toContain('saved application notes');
    response = receive();
    child.send({ action: 'recover-update', request: 2 });
    expect(await response).toEqual({ request: 2, ok: true });
    expect((await health()).ok).toBe(true);
    expect(await readFile(saved, 'utf8')).toContain('saved application notes');
  } finally {
    child.send('stop');
    await once(child, 'exit');
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);
