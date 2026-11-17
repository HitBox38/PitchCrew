import { afterEach, expect, it } from 'vitest';
import { runCliText } from '../src/process.ts';
import { cleanup, contextFor } from './helpers/runtime.ts';

afterEach(cleanup);

it('names a failure the runtime reported as a stream event instead of a bare exit code', async () => {
  // OpenCode 2 prints {"type":"error",...} on stdout, leaves stderr empty and exits 1; a real
  // usage-limit failure once surfaced only as "Runtime exited with code 1."
  const context = await contextFor('kiro-cli');
  const script =
    'process.stdout.write(JSON.stringify({type:"error",error:{message:"Free usage limit reached."}})); process.exit(1)';
  await expect(
    runCliText(
      process.execPath,
      ['--eval', script],
      context,
      'Fixture',
      () => null,
      {},
      (event) =>
        event.type === 'error' ? String((event.error as { message: string }).message) : null,
    ),
  ).rejects.toMatchObject({ message: 'Free usage limit reached.', code: 'PITCHCREW_RUNTIME_EXIT' });
});
