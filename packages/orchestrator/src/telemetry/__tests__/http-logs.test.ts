import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, setup } from '../../../test/helpers/daemon.ts';

afterEach(cleanup);

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
