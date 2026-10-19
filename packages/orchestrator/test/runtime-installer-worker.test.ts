import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { runRuntimeInstaller } from '../src/runtime-maintenance/installer.ts';

const fixture = fileURLToPath(
  new URL('../../adapters/test/fixtures/runtime-maintenance.ts', import.meta.url),
);
const args = ['--import', import.meta.resolve('tsx'), fixture];

it('streams a real fixture installer and retains its lock until the subprocess stops', async () => {
  const output: string[] = [];
  const key = `fixture-update-${crypto.randomUUID()}`;
  const result = await runRuntimeInstaller(
    { file: process.execPath, args: [...args, 'output'] },
    { lockKey: key, onOutput: (text) => output.push(text) },
  );
  expect(result.code).toBe(0);
  expect(output.join('')).toContain('Updating fixture runtime');
});

it('excludes a second worker and cancels only its owned installer', async () => {
  const key = `fixture-update-${crypto.randomUUID()}`;
  const controller = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const running = runRuntimeInstaller(
    { file: process.execPath, args: [...args, 'hang'] },
    { lockKey: key, signal: controller.signal, onOutput: started },
  );
  // Attach the rejection handler before cancellation to keep it owned by this test.
  const stopped = expect(running).rejects.toThrow('interrupted');
  await ready;
  try {
    await expect(
      runRuntimeInstaller({ file: process.execPath, args: [...args, 'output'] }, { lockKey: key }),
    ).rejects.toThrow('Another Pitchcrew workspace');
  } finally {
    controller.abort();
  }
  await stopped;
  expect(
    (
      await runRuntimeInstaller(
        { file: process.execPath, args: [...args, 'output'] },
        { lockKey: key },
      )
    ).code,
  ).toBe(0);
});
