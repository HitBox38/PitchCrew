import { describe, expect, it, vi } from 'vitest';
import { toolFailureReasons, userToolOutcomes } from '@pitchcrew/core/tool-failures';
import { createAnalytics } from '../client.ts';
import { errorSources, sanitizeException } from '../error-sanitizer.ts';
import { createErrorReporter } from '../error-tracking.ts';
import { sanitizeEvent } from '../helpers.ts';
import { createObservationRelay } from '../observations.ts';
import { createTelemetryBuffer } from '../../../../orchestrator/src/telemetry/buffer.ts';
import { sanitizeBackendObservation } from '../../../../orchestrator/src/telemetry/sanitize.ts';

const session = 'b3aa2328-dbf1-4618-a23b-45c695e9ab10';
const gateway = {
  error_source: 'tool_call',
  error_category: 'internal',
  error_tool: 'pitchcrew_list_roles',
  error_boundary: 'gateway',
  $mcp_session_id: session,
};
const runtime = {
  error_source: 'runtime_tool',
  error_category: 'timeout',
  error_tool_kind: 'command',
};
const injected = {
  message: 'private profile',
  stack: 'private path',
  $exception_list: [{ type: 'private', value: 'private', stacktrace: 'private' }],
  $exception_fingerprint: 'private',
  $issue_name: 'private',
  $session_id: 'private-tab-session',
};

describe('PostHog tool failure exceptions', () => {
  it('rebuilds a gateway tool failure from its reviewed name and closed reason only', () => {
    const result = sanitizeException({ ...gateway, ...injected });
    expect(result).toEqual({
      ...gateway,
      $session_id: session,
      $exception_list: [
        {
          type: 'internal',
          value:
            'Pitchcrew tool failed: pitchcrew_list_roles (internal). Pitchcrew hit an internal error.',
          mechanism: { type: 'tool_call', handled: true, synthetic: true },
        },
      ],
      $exception_fingerprint: 'pitchcrew-v1:tool_call:pitchcrew_list_roles:internal',
      $exception_level: 'error',
      $issue_name: 'Pitchcrew tool failed: pitchcrew_list_roles (internal)',
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(sanitizeException(result!)).toEqual(result);
    expect(sanitizeException({ ...gateway, error_boundary: 'runtime' })?.error_boundary).toBe(
      'runtime',
    );
  });

  it("describes a runtime's own tool only by its kind", () => {
    const result = sanitizeException({ ...runtime, ...injected });
    expect(result).toEqual({
      ...runtime,
      $exception_list: [
        {
          type: 'timeout',
          value: 'Agent runtime tool failed: command (timeout). The tool did not finish in time.',
          mechanism: { type: 'runtime_tool', handled: true, synthetic: true },
        },
      ],
      $exception_fingerprint: 'pitchcrew-v1:runtime_tool:command:timeout',
      $exception_level: 'error',
      $issue_name: 'Agent runtime tool failed: command (timeout)',
    });
    expect(sanitizeException(result!)).toEqual(result);
  });

  it("reports every closed reason except the user's own choices", () => {
    for (const reason of toolFailureReasons) {
      const result = sanitizeException({ ...gateway, error_category: reason });
      if (userToolOutcomes.includes(reason)) expect(result).toBeNull();
      else
        expect(result?.$exception_fingerprint).toBe(
          `pitchcrew-v1:tool_call:pitchcrew_list_roles:${reason}`,
        );
    }
  });

  it('rejects unreviewed tools, unknown words and mismatched fields', () => {
    for (const input of [
      { ...gateway, error_tool: 'private_tool' },
      { ...gateway, error_tool: undefined },
      { ...gateway, error_category: 'private_reason' },
      { ...gateway, error_source: 'runtime_tool' },
      { ...runtime, error_tool_kind: 'private_kind' },
      { ...runtime, error_source: 'tool_call' },
    ])
      expect(sanitizeException(input)).toBeNull();
    const unlinked = sanitizeException({ ...gateway, $mcp_session_id: 'private-session' });
    expect(unlinked).not.toHaveProperty('$mcp_session_id');
    expect(unlinked).not.toHaveProperty('$session_id');
  });

  it("can never be raised by the renderer's own error reporter", () => {
    expect(errorSources).not.toContain('tool_call');
    expect(errorSources).not.toContain('runtime_tool');
    const capture = vi.fn();
    const report = createErrorReporter(capture, () => true);
    report('tool_call' as never, new Error('private'), 'internal' as never);
    report('runtime_tool' as never, new Error('private'), 'timeout' as never);
    expect(capture).not.toHaveBeenCalled();
  });

  it("keeps the run's MCP session over the uploading tab's session", () => {
    const input = {
      event: '$exception',
      properties: { ...gateway, ...injected, $current_url: 'https://private.test' },
    };
    const output = sanitizeEvent(input)!;
    expect(output.properties.$session_id).toBe(session);
    expect(output.properties.$mcp_session_id).toBe(session);
    expect(JSON.stringify(output)).not.toContain('private');
    expect(sanitizeEvent(input, false)).toBeNull();
  });

  it('relays daemon observations through both SDK sanitization and current consent gates', async () => {
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
    const buffer = createTelemetryBuffer(sanitizeBackendObservation, true);
    const relay = createObservationRelay({
      allowed: () => analytics.diagnosticsEnabled(),
      read: async (after) => buffer.read(after),
      capture: (event, input) => analytics.captureDiagnostic(event, input),
    });
    await relay.poll();
    buffer.record('$exception', { ...gateway, message: 'private profile' });
    await relay.poll();
    expect(sdk.capture).toHaveBeenCalledOnce();
    const [event, captured] = sdk.capture.mock.calls[0];
    const expected = sanitizeException(gateway)!;
    expect(event).toBe('$exception');
    expect(captured).toMatchObject(expected);
    expect(JSON.stringify(captured)).not.toContain('private');
    const beforeSend = sdk.init.mock.calls[0][1].before_send;
    const outbound = { event, properties: { ...captured, ...injected } };
    expect(beforeSend(outbound).properties).toMatchObject(expected);
    expect(JSON.stringify(beforeSend(outbound))).not.toContain('private');
    diagnostics = false;
    expect(beforeSend(outbound)).toBeNull();
    buffer.record('$exception', gateway);
    await relay.poll();
    expect(sdk.capture).toHaveBeenCalledOnce();
    diagnostics = true;
    usage = false;
    expect(beforeSend(outbound)).toBeNull();
    await relay.poll();
    expect(sdk.capture).toHaveBeenCalledOnce();
  });
});
