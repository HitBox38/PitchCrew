import { describe, expect, it, vi } from 'vitest';
import { agentProblemAreas } from '@pitchcrew/core/telemetry-errors';
import { createAnalytics } from '../client.ts';
import { sanitizeException } from '../error-sanitizer.ts';
import { createObservationRelay } from '../observations.ts';
import { createTelemetryBuffer } from '../../../../orchestrator/src/telemetry/buffer.ts';
import { sanitizeBackendObservation } from '../../../../orchestrator/src/telemetry/sanitize.ts';

const properties = {
  error_source: 'agent_report',
  error_category: 'technical_problem',
  error_area: 'browser',
};

describe('PostHog agent technical errors', () => {
  it.each(agentProblemAreas)('rebuilds the %s exception using only reviewed properties', (area) => {
    const result = sanitizeException({
      ...properties,
      error_area: area,
      message: 'private profile',
      stack: 'private path',
      $exception_list: [{ type: 'private', value: 'private', stacktrace: 'private' }],
      $exception_fingerprint: 'private',
      $issue_name: 'private',
    });
    expect(result).toEqual({
      ...properties,
      error_area: area,
      $exception_list: [
        {
          type: 'technical_problem',
          value: `Pitchcrew agent technical problem: ${area}`,
          mechanism: { type: 'agent_report', handled: true, synthetic: true },
        },
      ],
      $exception_fingerprint: `pitchcrew-v1:agent_report:technical_problem:${area}`,
      $exception_level: 'error',
      $issue_name: `Pitchcrew agent technical problem: ${area}`,
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(sanitizeException(result!)).toEqual(result);
  });

  it('rejects missing, unknown or mismatched agent error fields', () => {
    for (const change of [
      { error_area: undefined },
      { error_area: 'private-area' },
      { error_category: 'generic_error' },
      { error_source: 'window_error' },
    ])
      expect(sanitizeException({ ...properties, ...change })).toBeNull();
  });

  it('relays local exceptions through both SDK sanitization and current consent gates', async () => {
    let usage = true;
    let diagnostics = true;
    const sdk = {
      init: vi.fn(),
      capture: vi.fn(),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
    };
    const analytics = createAnalytics(
      async () => sdk,
      () => usage,
      () => diagnostics,
    );
    await analytics.setEnabled(true, { token: 'fixture', host: 'https://eu.i.posthog.com' });
    const detailed = {
      ...properties,
      error_kind: 'missing_capability',
      error_summary: 'No batch update tool',
      error_expected: ('Update multiple jobs in one call. ' + 'Generic detail. '.repeat(15)).trim(),
      error_actual: 'Only individual updates are available.',
      error_steps: 'Select jobs and inspect available tools.',
      error_workaround: 'Repeated individual updates.',
      error_tool: 'pitchcrew_update_job',
    };
    const buffer = createTelemetryBuffer(sanitizeBackendObservation, true);
    const relay = createObservationRelay({
      allowed: () => analytics.diagnosticsEnabled(),
      read: async (after) => buffer.read(after),
      capture: (event, input) => analytics.captureDiagnostic(event, input),
    });
    await relay.poll();
    buffer.record('$exception', detailed);
    await relay.poll();
    expect(sdk.capture).toHaveBeenCalledOnce();
    const [event, captured] = sdk.capture.mock.calls[0];
    expect(event).toBe('$exception');
    expect(captured).toMatchObject(detailed);
    expect(captured.$issue_name).toBe('Pitchcrew missing capability: No batch update tool');
    expect(captured.$exception_list[0].value).toContain(
      `Expected: ${detailed.error_expected}\nActual: ${detailed.error_actual}`,
    );
    const beforeSend = sdk.init.mock.calls[0][1].before_send;
    const outbound = {
      event,
      properties: { ...captured, $exception_list: [{ value: 'private' }] },
    };
    expect(beforeSend(outbound).properties).toMatchObject(sanitizeException(detailed)!);
    diagnostics = false;
    expect(beforeSend(outbound)).toBeNull();
    buffer.record('$exception', detailed);
    await relay.poll();
    expect(sdk.capture).toHaveBeenCalledOnce();
    diagnostics = true;
    usage = false;
    expect(beforeSend(outbound)).toBeNull();
    await relay.poll();
    expect(sdk.capture).toHaveBeenCalledOnce();
  });

  it('keeps distinct issues separate and rebuilds redacted details at every boundary', () => {
    const input = {
      ...properties,
      error_kind: 'bug',
      error_summary: 'Cannot save browser state',
      error_expected: 'Save the state.',
      error_actual:
        'Failed for person@example.com at https://private.test/path using token=private-value',
      error_steps: 'Open /Users/private/browser or C:\\Users\\private\\browser then save.',
    };
    const result = sanitizeException(input)!;
    expect(result.error_actual).toBe('Failed for [email] at [url] using [credential]');
    expect(result.error_steps).toBe('Open [path] or [path] then save.');
    expect(JSON.stringify(result)).not.toMatch(/private|person@example/);
    expect(sanitizeException(result)).toEqual(result);
    expect(
      sanitizeException({ ...input, error_summary: 'Cannot open browser' })!.$exception_fingerprint,
    ).not.toBe(result.$exception_fingerprint);
    expect(
      sanitizeException({ ...input, error_kind: 'missing_capability' })!.$exception_fingerprint,
    ).not.toBe(result.$exception_fingerprint);
  });
});
