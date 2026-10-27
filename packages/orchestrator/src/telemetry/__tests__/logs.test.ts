import { describe, expect, it, vi } from 'vitest';
import { createTelemetryBuffer } from '../buffer.ts';
import { recordOperationalLog, sanitizeLogObservation } from '../logs.ts';
import { failureCategory, failureDetails } from '@pitchcrew/core/operational-logs';

describe('content-free operational logs', () => {
  it('retains only reviewed HTTP correlation across the actual buffer sanitizer', () => {
    const buffer = createTelemetryBuffer(sanitizeLogObservation, true);
    const correlation = {
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: '1234567890abcdef',
      traceFlags: 1,
      sessionId: '019a1234-5678-7000-8000-000000000001',
      posthogDistinctId: '019a1234-5678-7000-8000-000000000002',
    };
    const log = { code: 'http_request_failed', area: 'http', ...correlation } as const;
    recordOperationalLog(buffer, log);
    expect(buffer.read(0).observations[0]?.properties).toEqual(log);
    expect(
      sanitizeLogObservation('operational_log', {
        code: 'daemon_ready',
        area: 'daemon',
        ...correlation,
      }),
    ).toEqual({ code: 'daemon_ready', area: 'daemon' });
    expect(
      sanitizeLogObservation('operational_log', {
        ...log,
        traceId: '0'.repeat(32),
        spanId: 'private',
        traceFlags: 999,
        sessionId: '/private/profile.md',
        posthogDistinctId: 'person@example.test',
        baggage: 'private',
      }),
    ).toEqual({ code: 'http_request_failed', area: 'http' });
  });
  it('keeps exit details only on runtime exits and never retains unknown error properties', () => {
    const error = Object.assign(new Error('private stderr'), {
      code: 'PITCHCREW_RUNTIME_EXIT',
      exitCode: 0xffff_ffff,
      signal: 'SIGKILL',
      private: 'secret',
    });
    expect(failureDetails(error)).toEqual({
      failure_category: 'process_exit',
      runtime_exit_code: 0xffff_ffff,
      runtime_exit_signal: 'SIGKILL',
    });
    expect(failureDetails({ ...error })).toEqual({ failure_category: 'other' });
    expect(failureDetails(Object.assign(error, { code: 'unknown' }))).toEqual({
      failure_category: 'other',
    });
    for (const area of ['http', 'daemon'])
      expect(
        sanitizeLogObservation('operational_log', {
          code: area === 'http' ? 'http_request_failed' : 'daemon_start_failed',
          area,
          failure_category: 'process_exit',
          runtime_exit_code: 7,
          runtime_exit_signal: 'SIGTERM',
        }),
      ).toEqual({
        code: area === 'http' ? 'http_request_failed' : 'daemon_start_failed',
        area,
        failure_category: 'process_exit',
      });
  });
  it('keeps bounded failure details and drops private diagnostic input', () => {
    expect(failureCategory(new Error('Runtime exited with code 1.'))).toBe('process_exit');
    expect(failureCategory(new Error('private provider stderr'))).toBe('other');
    expect(
      failureCategory(
        Object.assign(new Error('private provider stderr'), { code: 'PITCHCREW_RUNTIME_EXIT' }),
      ),
    ).toBe('process_exit');
    expect(failureCategory(Object.assign(new Error('/private/cli'), { code: 'ENOENT' }))).toBe(
      'executable_missing',
    );
    expect(
      sanitizeLogObservation('operational_log', {
        code: 'http_request_failed',
        area: 'http',
        http_status: 503,
        failure_category: 'timeout',
        operation: 'packet_export_requested',
        message: 'private',
      }),
    ).toEqual({
      code: 'http_request_failed',
      area: 'http',
      http_status: 503,
      failure_category: 'timeout',
      operation: 'packet_export_requested',
    });
    expect(
      sanitizeLogObservation('operational_log', {
        code: 'http_request_failed',
        area: 'http',
        http_status: 999,
        failure_category: '/private/error',
        operation: '/cards/private/run?token=secret',
      }),
    ).toEqual({ code: 'http_request_failed', area: 'http' });
  });
  it('rebuilds fixed codes, rejecting unknown codes and mismatched areas', () => {
    expect(
      sanitizeLogObservation('operational_log', {
        code: 'runtime_run_failed',
        area: 'chat',
        message: '/private/profile.md',
        stack: 'secret',
        roleId: 'writer',
        token: 'secret',
        runtime: 'custom-provider',
        operation: 'workflow_started',
      }),
    ).toEqual({ code: 'runtime_run_failed', area: 'chat' });
    expect(
      sanitizeLogObservation('operational_log', { code: 'constructor', area: 'http' }),
    ).toBeNull();
    expect(
      sanitizeLogObservation('operational_log', { code: 'runtime_run_failed', area: 'daemon' }),
    ).toBeNull();
    expect(sanitizeLogObservation('other', { code: 'daemon_ready', area: 'daemon' })).toBeNull();
  });
  it('keeps logs in the consent-mediated ephemeral buffer and leaves application errors alone', () => {
    const buffer = createTelemetryBuffer(sanitizeLogObservation, true);
    recordOperationalLog(buffer, { code: 'runtime_run_failed', area: 'workflow' });
    expect(buffer.read(0).observations).toEqual([
      {
        sequence: 1,
        event: 'operational_log',
        properties: { code: 'runtime_run_failed', area: 'workflow' },
      },
    ]);
    const disabled = createTelemetryBuffer(sanitizeLogObservation);
    recordOperationalLog(disabled, { code: 'daemon_ready', area: 'daemon' });
    expect(disabled.read(0).observations).toEqual([]);
    expect(() =>
      recordOperationalLog(
        {
          record: vi.fn(() => {
            throw new Error('sink');
          }),
        },
        {
          code: 'runtime_run_cancelled',
          area: 'chat',
        },
      ),
    ).not.toThrow();
  });
});
