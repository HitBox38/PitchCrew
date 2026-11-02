import { describe, expect, it } from 'vitest';
import {
  agentProblemInput,
  sanitizeAgentProblem,
  sanitizeProblemText,
} from '../src/telemetry-errors.ts';

describe('agent report privacy boundary', () => {
  it('redacts common identifiers and credentials, removes terminal formatting and remains idempotent', () => {
    const text =
      '\u001b[31mFailed\u001b[0m\n' +
      'https://example.test/private?token=secret file:///home/person/private person@example.test ' +
      '/Users/person/private C:\\Users\\person\\private ~/private ' +
      'Bearer private-value sk_private_value token=private-value api_key=private-value ' +
      '12345678-1234-1234-1234-123456789abc';
    const result = sanitizeProblemText(text, 1000)!;
    expect(result).toBe(
      'Failed [url] [url] [email] [path] [path] [path] [credential] [credential] [credential] [credential] [id]',
    );
    expect(sanitizeProblemText(result, 1000)).toBe(result);
  });

  it('drops malformed, nested, oversized and partial detail without copying unreviewed payloads', () => {
    const legacy = {
      error_source: 'agent_report',
      error_category: 'technical_problem',
      error_area: 'mcp',
    };
    for (const error_actual of [undefined, { value: 'private' }, 'x'.repeat(601)])
      expect(
        sanitizeAgentProblem({
          ...legacy,
          error_summary: 'Incomplete',
          error_expected: 'Work',
          error_actual,
          error_steps: 'Private partial steps',
          message: 'private',
          $exception_list: [{ value: 'private' }],
        }),
      ).toEqual(legacy);
    expect(sanitizeProblemText('x'.repeat(601), 600)).toBeUndefined();
    expect(sanitizeProblemText('  ', 600)).toBeUndefined();
    expect(sanitizeProblemText({}, 600)).toBeUndefined();
  });

  it('retains legacy input and requires the full expected/actual report when details are supplied', () => {
    expect(agentProblemInput.parse({ area: 'mcp' })).toEqual({ area: 'mcp' });
    for (const input of [
      { kind: 'missing_capability' },
      { summary: 'Incomplete' },
      { steps: 'Incomplete' },
      { summary: 'Failure', expected: 'Work', actual: 'Failed', secret: 'private' },
    ])
      expect(agentProblemInput.safeParse({ area: 'mcp', ...input }).success).toBe(false);
    expect(
      agentProblemInput.parse({
        area: 'mcp',
        kind: 'missing_capability',
        summary: 'No batch operation',
        expected: 'One call for several jobs',
        actual: 'Only individual calls are available',
      }).kind,
    ).toBe('missing_capability');
  });
});
