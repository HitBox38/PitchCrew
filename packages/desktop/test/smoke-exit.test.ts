import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { waitForSmokeExit } from '../../../scripts/desktop-smoke-exit.ts';
const fixture = async (source: string) => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-smoke-exit-'));
  directories.push(directory);
  const child = spawn(process.execPath, ['-e', source], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  return { child, evidence: join(directory, 'result.json') };
};

const children: ChildProcess[] = [];
const directories: string[] = [];
afterEach(async () => {
  for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
  await Promise.all(
    directories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test('reports actual process exit separately from the native quit event', async () => {
  const { child, evidence } = await fixture('setTimeout(() => process.exit(0), 250)');
  const requestedAt = Date.now() - 25;
  await writeFile(
    `${evidence}.shutdown.json`,
    JSON.stringify({ requestedAt, events: { quit: 2 } }),
  );
  const result = await waitForSmokeExit(child, evidence, { timeoutMs: 5_000 });
  expect(result.shutdown).toEqual({ requestedAt, events: { quit: 2 } });
  expect(result.shutdownToExitMs).toBeGreaterThanOrEqual(25);
});

test('a native failure cannot pass because UI evidence exists', async () => {
  const { child, evidence } = await fixture('setTimeout(() => process.exit(7), 100)');
  await writeFile(evidence, JSON.stringify({ uiReady: true, windowStayedHidden: true }));
  await expect(waitForSmokeExit(child, evidence, { timeoutMs: 5_000 })).rejects.toThrow(
    'exited with 7',
  );
});

test.skipIf(process.platform === 'win32')(
  'fails and finishes when a child ignores graceful termination after the deadline',
  async () => {
    const { child, evidence } = await fixture(
      "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000)",
    );
    await once(child.stdout!, 'data');
    await writeFile(
      `${evidence}.shutdown.json`,
      JSON.stringify({ requestedAt: Date.now(), events: { quit: 3 } }),
    );
    const exited = once(child, 'exit');
    await expect(
      waitForSmokeExit(child, evidence, { timeoutMs: 50, terminationGraceMs: 50 }),
    ).rejects.toThrow(/timed out.*Forced test cleanup.*Native shutdown evidence.*quit/);
    const [, signal] = await exited;
    expect(signal).toBe('SIGKILL');
  },
);

test('uses a separate shutdown deadline after quit while retaining the longer UI deadline', async () => {
  const { child, evidence } = await fixture(
    "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000)",
  );
  await once(child.stdout!, 'data');
  await writeFile(
    `${evidence}.shutdown.json`,
    JSON.stringify({ requestedAt: Date.now(), events: { quit: 3 } }),
  );
  await expect(
    waitForSmokeExit(child, evidence, {
      timeoutMs: 5_000,
      shutdownTimeoutMs: 50,
      terminationGraceMs: 50,
    }),
  ).rejects.toThrow('Electron shutdown timed out after 50 ms');
});

test('does not pass a zero exit without completed shutdown evidence', async () => {
  const { child, evidence } = await fixture('setTimeout(() => process.exit(0), 100)');
  await expect(waitForSmokeExit(child, evidence, { timeoutMs: 5_000 })).rejects.toThrow(
    'without completed native shutdown evidence',
  );
});

test.skipIf(process.platform === 'win32')(
  'a zero exit in response to deadline termination still fails',
  async () => {
    const { child, evidence } = await fixture(
      "process.on('SIGTERM', () => process.exit(0)); console.log('ready'); setInterval(() => {}, 1000)",
    );
    await once(child.stdout!, 'data');
    await expect(
      waitForSmokeExit(child, evidence, { timeoutMs: 50, terminationGraceMs: 1_000 }),
    ).rejects.toThrow('Electron check timed out after 50 ms');
    expect(child.exitCode).toBe(0);
  },
);
