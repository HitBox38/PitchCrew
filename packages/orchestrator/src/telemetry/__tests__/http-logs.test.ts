import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, setup } from '../../../test/helpers/daemon.ts';
import { trace } from '@opentelemetry/api';

afterEach(cleanup);

it('captures independent originating request identities and W3C context before the relay boundary', async () => {
  const { daemon, request } = await setup(14697);
  const record = vi.spyOn(daemon.service.diagnostics!, 'record');
  const traceId = '1234567890abcdef1234567890abcdef';
  const spanId = '1234567890abcdef';
  const sessions = [randomUUID(), randomUUID()];
  const distinctIds = [randomUUID(), randomUUID()];
  await Promise.all(
    sessions.map((sessionId, index) =>
      request(
        '/cards',
        'POST',
        {},
        {
          'x-posthog-session-id': sessionId,
          'x-posthog-distinct-id': distinctIds[index]!,
          traceparent: `00-${traceId}-${spanId}-01`,
        },
      ),
    ),
  );
  for (const [index, sessionId] of sessions.entries()) {
    expect(record).toHaveBeenCalledWith(
      'operational_log',
      expect.objectContaining({
        sessionId,
        posthogDistinctId: distinctIds[index],
        traceId,
        spanId,
        traceFlags: 1,
      }),
    );
  }
  record.mockClear();
  await request(
    '/cards',
    'POST',
    {},
    {
      'x-posthog-session-id': 'private email',
      'x-posthog-distinct-id': 'private path',
      traceparent: `00-${traceId}-${'0'.repeat(16)}-01`,
    },
  );
  expect(record).toHaveBeenCalledExactlyOnceWith('operational_log', {
    code: 'http_request_failed',
    area: 'http',
    http_status: 400,
    failure_category: 'validation',
  });
});

it('uses the active server span at error emission in preference to the incoming parent span', async () => {
  const { daemon, request } = await setup(14697);
  const record = vi.spyOn(daemon.service.diagnostics!, 'record');
  const span = {
    traceId: 'abcdef1234567890abcdef1234567890',
    spanId: 'abcdef1234567890',
    traceFlags: 1,
  };
  vi.spyOn(trace, 'getActiveSpan').mockReturnValue(trace.wrapSpanContext(span));
  await request(
    '/cards',
    'POST',
    {},
    {
      traceparent: '00-1234567890abcdef1234567890abcdef-1234567890abcdef-00',
    },
  );
  expect(record).toHaveBeenCalledWith('operational_log', expect.objectContaining(span));
});

it('identifies export and workflow failures without recording request content', async () => {
  const { daemon, request } = await setup(14697);
  const record = vi.spyOn(daemon.service.diagnostics!, 'record');
  const id = randomUUID();
  const cases = [
    [`/cards/${id}/approval`, 'packet_export_requested', 400, 'other'],
    [`/cards/${id}/run`, 'workflow_started', 400, 'validation'],
    [`/approvals/${id}/export`, 'packet_exported', 503, 'timeout'],
  ] as const;
  vi.spyOn(daemon.service, 'exportPacket').mockRejectedValueOnce(
    Object.assign(new Error('private filesystem detail'), {
      statusCode: 503,
      code: 'ETIMEDOUT',
    }),
  );

  for (const [path, operation, status, failure_category] of cases) {
    record.mockClear();
    const { response, result } = await request<{ error: string }>(
      `${path}?secret=private-query`,
      'POST',
      { operation: 'private-body' },
    );
    expect(response.status).toBe(status);
    expect(result.error).toBeTruthy();
    expect(record.mock.calls).toEqual([
      [
        'operational_log',
        {
          code: 'http_request_failed',
          area: 'http',
          http_status: status,
          failure_category,
          operation,
        },
      ],
    ]);
    expect(JSON.stringify(record.mock.calls)).not.toContain(id);
    expect(JSON.stringify(record.mock.calls)).not.toContain('private');
  }

  record.mockClear();
  expect((await request('/snapshot')).response.status).toBe(200);
  expect(record).not.toHaveBeenCalled();
});
