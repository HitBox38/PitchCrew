import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOperationalLogTransport } from '../transport.ts';

const config = { token: 'phc_fixture_token', host: 'https://eu.i.posthog.com' };
const log = {
  code: 'runtime_run_failed',
  area: 'workflow',
  message: 'private job',
  stack: '/Users/private',
};
const context = () => ({
  app_version: '0.2.0',
  renderer: 'electron' as const,
  analytics_schema: 2,
});
const setup = (
  send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 })),
) => {
  let enabled = true;
  const transport = createOperationalLogTransport({
    consent: () => enabled,
    getDistinctId: () => 'sdk-anonymous-id',
    context,
    fetch: send,
    now: () => 1760000000123,
  });
  transport.setEnabled(true, config);
  return {
    transport,
    send,
    disable: () => {
      enabled = false;
      transport.setEnabled(false, config);
    },
  };
};
afterEach(() => vi.useRealTimers());

describe('native PostHog OTLP logs', () => {
  it('sends only reviewed records as OTLP JSON with public project auth, no content or referrer', async () => {
    const { transport, send } = setup();
    expect(await transport.capture('operational_log', log)).toBe(true);
    const [url, request] = send.mock.calls[0]!;
    expect(url).toBe('https://eu.i.posthog.com/i/v1/logs');
    expect(request).toMatchObject({
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      headers: { Authorization: 'Bearer phc_fixture_token', 'Content-Type': 'application/json' },
    });
    const payload = JSON.parse(request!.body as string);
    const resource = payload.resourceLogs[0];
    expect(resource.resource.attributes).toEqual([
      { key: 'service.name', value: { stringValue: 'pitchcrew-runtime' } },
      { key: 'service.version', value: { stringValue: '0.2.0' } },
    ]);
    const record = resource.scopeLogs[0].logRecords[0];
    expect(record).toMatchObject({
      timeUnixNano: '1760000000123000000',
      severityNumber: 17,
      severityText: 'ERROR',
      body: { stringValue: 'runtime_run_failed' },
    });
    expect(record.attributes.map((attr: { key: string }) => attr.key)).toEqual([
      'code',
      'area',
      'renderer',
      'analytics_schema',
      'posthogDistinctId',
    ]);
    expect(request!.body).not.toContain('private');
    expect(request!.body).not.toContain('/Users');
    transport.dispose();
  });
  it('drops missing consent, config, SDK identity, unknown codes and unsafe config without queuing', async () => {
    const { transport, send, disable } = setup();
    expect(await transport.capture('chat_sent', log)).toBe(false);
    expect(await transport.capture('operational_log', { code: 'private', area: 'chat' })).toBe(
      false,
    );
    disable();
    expect(await transport.capture('operational_log', log)).toBe(false);
    transport.setEnabled(true, null);
    expect(await transport.capture('operational_log', log)).toBe(false);
    const noIdentity = createOperationalLogTransport({
      consent: () => true,
      getDistinctId: () => undefined,
      context,
      fetch: send,
    });
    noIdentity.setEnabled(true, config);
    expect(await noIdentity.capture('operational_log', log)).toBe(false);
    const unsafe = setup();
    for (const host of [
      'http://localhost',
      'https://eu.i.posthog.com/path',
      'https://secret@eu.i.posthog.com',
      'https://eu.i.posthog.com?token=x',
    ]) {
      unsafe.transport.setEnabled(true, { ...config, host });
      expect(await unsafe.transport.capture('operational_log', log)).toBe(false);
    }
    expect(send).not.toHaveBeenCalled();
    expect(unsafe.send).not.toHaveBeenCalled();
    unsafe.transport.dispose();
  });
  it('bounds concurrent requests and aborts them on opt-out without retry or later flush', async () => {
    const send = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_, reject) => {
          init!.signal!.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const { transport, disable } = setup(send);
    const first = transport.capture('operational_log', log);
    const second = transport.capture('operational_log', log);
    expect(await transport.capture('operational_log', log)).toBe(false);
    expect(send).toHaveBeenCalledTimes(2);
    disable();
    expect(await first).toBe(false);
    expect(await second).toBe(false);
    transport.setEnabled(true, config);
    expect(send).toHaveBeenCalledTimes(2);
    transport.dispose();
  });
  it('aborts requests after five seconds, never retries errors, and drops disposed captures', async () => {
    vi.useFakeTimers();
    const send = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_, reject) => {
          init!.signal!.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const { transport } = setup(send);
    const capture = transport.capture('operational_log', log);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await capture).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    transport.dispose();
    transport.setEnabled(true, config);
    expect(await transport.capture('operational_log', log)).toBe(false);
    const failed = setup(
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 })),
    );
    expect(await failed.transport.capture('operational_log', log)).toBe(false);
    expect(failed.send).toHaveBeenCalledTimes(1);
    failed.transport.dispose();
  });
});
