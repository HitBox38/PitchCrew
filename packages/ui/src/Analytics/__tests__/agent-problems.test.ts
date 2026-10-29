import { describe, expect, it, vi } from 'vitest';
import { agentProblemAreas } from '@pitchcrew/core/telemetry-errors';
import { createAnalytics } from '../client.ts';
import { sanitizeException } from '../error-sanitizer.ts';
import { createObservationRelay } from '../observations.ts';

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
    let cursor = 0;
    const relay = createObservationRelay({
      allowed: () => analytics.diagnosticsEnabled(),
      read: async () => ({
        enabled: true,
        streamId: 'fixture',
        cursor,
        observations: cursor ? [{ sequence: cursor, event: '$exception', properties }] : [],
      }),
      capture: (event, input) => analytics.captureDiagnostic(event, input),
    });
    await relay.poll();
    cursor++;
    await relay.poll();
    expect(sdk.capture).toHaveBeenCalledOnce();
    const [event, captured] = sdk.capture.mock.calls[0];
    expect(event).toBe('$exception');
    expect(captured).toMatchObject(properties);
    const beforeSend = sdk.init.mock.calls[0][1].before_send;
    const outbound = {
      event,
      properties: { ...captured, $exception_list: [{ value: 'private' }] },
    };
    expect(beforeSend(outbound).properties).toMatchObject(sanitizeException(properties)!);
    diagnostics = false;
    expect(beforeSend(outbound)).toBeNull();
    cursor++;
    await relay.poll();
    expect(sdk.capture).toHaveBeenCalledOnce();
    diagnostics = true;
    usage = false;
    expect(beforeSend(outbound)).toBeNull();
    await relay.poll();
    expect(sdk.capture).toHaveBeenCalledOnce();
  });
});
