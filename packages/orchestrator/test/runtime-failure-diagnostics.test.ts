import { afterEach, expect, it, vi } from 'vitest';
import { sanitizeAiObservation } from '@pitchcrew/core/telemetry-ai';
import { runCli } from '../../adapters/src/process.ts';
import { cleanup, contextFor } from '../../adapters/test/helpers/runtime.ts';
import { beginAiRun } from '../src/telemetry/ai.ts';

afterEach(cleanup);

it.each([
  '',
  'private provider output /Users/fixture/profile.md phx_fixture',
  JSON.stringify({ role: 'scout', fit: 'private invalid score', reasons: [] }),
  JSON.stringify({ role: 'reviewer', passed: true, feedback: [] }),
])('retains safe validation context for rejected workflow output %#', async (output) => {
  const context = await contextFor('kiro-cli');
  const record = vi.fn();
  const ai = beginAiRun({ record }, 'workflow');
  await expect(
    ai.observe(
      () =>
        runCli(
          process.execPath,
          ['--eval', `process.stdout.write(${JSON.stringify(JSON.stringify({ result: output }))})`],
          context,
          'Private fixture prompt',
          (event) => (typeof event.result === 'string' ? event.result : null),
        ),
      context.signal,
    ),
  ).rejects.toThrow(
    'The runtime did not return a valid structured result. Check its model/sign-in and retry.',
  );
  ai.finish('failed');
  expect(record.mock.calls.map(([event]) => event)).toEqual(['$ai_span', '$ai_trace']);
  for (const [event, properties] of record.mock.calls) {
    expect(properties).toMatchObject({
      outcome: 'failed',
      $ai_is_error: true,
      failure_category: 'validation',
      $ai_error: 'validation',
    });
    expect(sanitizeAiObservation(event, properties)).toEqual(properties);
  }
  expect(JSON.stringify(record.mock.calls)).not.toMatch(/private|Private|Users|profile|phx/);
});

it('retains process-exit context and the exact private local exception', async () => {
  const context = await contextFor('kiro-cli');
  const record = vi.fn();
  const ai = beginAiRun({ record }, 'workflow');
  const error = await ai
    .observe(
      () =>
        runCli(
          process.execPath,
          ['--eval', "process.stderr.write('private stderr'); process.exit(1)"],
          context,
          'Private fixture prompt',
          () => null,
        ),
      context.signal,
    )
    .catch((error: unknown) => error);
  expect(error).toMatchObject({ message: 'private stderr', code: 'PITCHCREW_RUNTIME_EXIT' });
  ai.fail(error);
  ai.finish('failed');
  for (const [event, properties] of record.mock.calls) {
    expect(properties).toMatchObject({
      failure_category: 'process_exit',
      $ai_error: 'process_exit',
    });
    expect(sanitizeAiObservation(event, properties)).toEqual(properties);
  }
  expect(JSON.stringify(record.mock.calls)).not.toContain('private');
});
