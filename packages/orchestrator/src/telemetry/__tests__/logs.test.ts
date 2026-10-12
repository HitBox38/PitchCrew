import { describe, expect, it, vi } from 'vitest';
import { createTelemetryBuffer } from '../buffer.ts';
import { recordOperationalLog, sanitizeLogObservation } from '../logs.ts';

describe('content-free operational logs', () => {
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
