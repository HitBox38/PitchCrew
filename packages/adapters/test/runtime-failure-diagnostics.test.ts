import { afterEach, expect, it } from 'vitest';
import { failureCategory } from '@pitchcrew/core/operational-logs';
import { beginAiRun } from '../../orchestrator/src/telemetry/ai.ts';
import { sanitizeAiObservation } from '@pitchcrew/core/telemetry-ai';
import { runAcpText } from '../src/acp.ts';
import { runCli, runCliText } from '../src/process.ts';
import { cleanup, contextFor } from './helpers/runtime.ts';

afterEach(cleanup);

it.each([
  ['cli', 7],
  ['acp', 7],
  ['acp', 0],
] as const)(
  '%s preserves a real process exit (%i) through the AI boundary without private stderr',
  async (transport, exitCode) => {
    const context = await contextFor('kiro-cli');
    const observations: Array<Record<string, unknown>> = [];
    const ai = beginAiRun(
      { record: (_event, properties) => observations.push(properties) },
      'workflow',
    );
    const args = [
      '--eval',
      `process.stderr.write('private /profile.md token'); process.exit(${exitCode})`,
    ];
    let original: unknown;
    await expect(
      ai.observe(async () => {
        try {
          return await (transport === 'cli'
            ? runCliText(process.execPath, args, context, 'Fixture', () => null)
            : runAcpText(process.execPath, args, context, 'Fixture'));
        } catch (error) {
          original = error;
          throw error;
        }
      }, context.signal),
    ).rejects.toMatchObject({
      message: 'private /profile.md token',
      code: 'PITCHCREW_RUNTIME_EXIT',
      exitCode,
    });
    expect(failureCategory(original)).toBe('process_exit');
    ai.fail(original);
    ai.finish('failed');
    expect(observations).toHaveLength(2);
    for (const observation of observations) {
      expect(observation).toMatchObject({
        failure_category: 'process_exit',
        runtime_exit_code: exitCode,
      });
      expect(
        sanitizeAiObservation(observation.$ai_span_id ? '$ai_span' : '$ai_trace', observation),
      ).toEqual(observation);
    }
    expect(JSON.stringify(observations)).not.toMatch(/private|profile|token/);
  },
);

it.each(['', 'private invalid JSON', '{}', '{"role":"reviewer","passed":true,"feedback":[]}'])(
  'classifies invalid workflow output as validation while preserving the local error (%s)',
  async (output) => {
    const context = await contextFor('kiro-cli');
    const observations: Array<Record<string, unknown>> = [];
    const ai = beginAiRun(
      { record: (_event, properties) => observations.push(properties) },
      'workflow',
    );
    const line = JSON.stringify({ result: output }) + '\n';
    const error = await ai
      .observe(
        () =>
          runCli(
            process.execPath,
            ['--eval', `process.stdout.write(${JSON.stringify(line)})`],
            context,
            'Fixture',
            (event) => (typeof event.result === 'string' ? event.result : null),
          ),
        context.signal,
      )
      .catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ message: expect.stringContaining('valid structured result') });
    expect(failureCategory(error)).toBe('validation');
    ai.fail(error);
    ai.finish('failed');
    expect(observations).toHaveLength(2);
    for (const observation of observations)
      expect(observation).toMatchObject({
        failure_category: 'validation',
        $ai_error: 'validation',
      });
    expect(JSON.stringify(observations)).not.toContain('private');
  },
);

it.skipIf(process.platform === 'win32').each(['cli', 'acp'] as const)(
  '%s retains a real termination signal without inventing an exit code',
  async (transport) => {
    const context = await contextFor('kiro-cli');
    const args = ['--eval', "process.kill(process.pid, 'SIGTERM')"];
    const observations: Array<Record<string, unknown>> = [];
    const ai = beginAiRun(
      { record: (_event, properties) => observations.push(properties) },
      'workflow',
    );
    await expect(
      ai.observe(
        () =>
          transport === 'cli'
            ? runCliText(process.execPath, args, context, 'Fixture', () => null)
            : runAcpText(process.execPath, args, context, 'Fixture'),
        context.signal,
      ),
    ).rejects.toMatchObject({
      code: 'PITCHCREW_RUNTIME_EXIT',
      exitCode: null,
      signal: 'SIGTERM',
    });
    ai.finish('failed');
    expect(observations).toHaveLength(2);
    for (const observation of observations) {
      expect(observation).toMatchObject({
        failure_category: 'process_exit',
        runtime_exit_signal: 'SIGTERM',
      });
      expect(observation).not.toHaveProperty('runtime_exit_code');
    }
  },
);
