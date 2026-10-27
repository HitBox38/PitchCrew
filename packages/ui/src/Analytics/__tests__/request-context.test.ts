import { afterEach, expect, it, vi } from 'vitest';
import { trace } from '@opentelemetry/api';

const getRequestContext = vi.hoisted(() => vi.fn());
vi.mock('../client.ts', () => ({ analytics: { getRequestContext, capture: vi.fn() } }));
import { api } from '../../api.ts';
import { diagnosticRequestHeaders } from '../request-context.ts';

const ids = {
  sessionId: '019a1234-5678-7000-8000-000000000001',
  posthogDistinctId: '019a1234-5678-7000-8000-000000000002',
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  getRequestContext.mockReset();
});

it('sends the native SDK session and distinct IDs on each API request, refreshing them at dispatch', async () => {
  getRequestContext.mockReturnValue(ids);
  const send = vi.fn().mockImplementation(async () => new Response('{}'));
  vi.stubGlobal('fetch', send);
  await api('/snapshot');
  expect(send.mock.lastCall?.[1].headers).toMatchObject({
    'x-pitchcrew-client': 'ui',
    'x-posthog-session-id': ids.sessionId,
    'x-posthog-distinct-id': ids.posthogDistinctId,
  });
  getRequestContext.mockReturnValue(undefined);
  await api('/snapshot');
  expect(send.mock.lastCall?.[1].headers).toEqual({ 'x-pitchcrew-client': 'ui' });
});

it('propagates a real active span but never invents a trace or sends IDs without diagnostic consent', () => {
  const span = {
    traceId: '1234567890abcdef1234567890abcdef',
    spanId: '1234567890abcdef',
    traceFlags: 1,
  };
  vi.spyOn(trace, 'getActiveSpan').mockReturnValue(trace.wrapSpanContext(span));
  getRequestContext.mockReturnValue(ids);
  expect(diagnosticRequestHeaders()).toMatchObject({
    traceparent: `00-${span.traceId}-${span.spanId}-01`,
  });
  vi.mocked(trace.getActiveSpan).mockReturnValue(undefined);
  expect(diagnosticRequestHeaders()).not.toHaveProperty('traceparent');
  getRequestContext.mockReturnValue(undefined);
  expect(diagnosticRequestHeaders()).toEqual({});
});

it('drops malformed identities and isolates SDK errors from API calls', () => {
  getRequestContext.mockReturnValue({
    sessionId: 'private email',
    posthogDistinctId: 'private path',
  });
  expect(diagnosticRequestHeaders()).toEqual({});
  getRequestContext.mockImplementation(() => {
    throw new Error('SDK unavailable');
  });
  expect(diagnosticRequestHeaders()).toEqual({});
});
