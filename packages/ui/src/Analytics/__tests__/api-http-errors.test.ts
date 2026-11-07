import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../../api.ts';
import { ApiHttpError } from '../../api-errors.ts';
import { createErrorReporter } from '../error-tracking.ts';

const { capture, finish, reportErrorDiagnostic } = vi.hoisted(() => ({
  capture: vi.fn(),
  finish: vi.fn(),
  reportErrorDiagnostic: vi.fn(),
}));
vi.mock('../client.ts', () => ({ analytics: { capture } }));
vi.mock('../metrics/runtime.ts', () => ({ beginApiMetric: () => finish }));
vi.mock('../error-tracking.ts', async (original) => ({
  ...(await original<typeof import('../error-tracking.ts')>()),
  reportErrorDiagnostic,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it.each([400, 409])('retains HTTP %s and its plain JSON rejection reason', async (status) => {
  // The production answer-context guards currently return 400 with this exact reason.
  const reason =
    'The originating agent’s capabilities changed. Cancel this question and start a new request.';
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: reason }), { status })),
  );
  const error = await api('/user-input/question/answer', 'POST', { text: 'private answer' }).catch(
    (error: unknown) => error,
  );
  expect(error).toBeInstanceOf(ApiHttpError);
  expect(error).toMatchObject({
    name: 'ApiHttpError',
    status,
    message: reason,
    serverMessage: reason,
  });
  expect(error).not.toHaveProperty('mutationAccepted');
  expect(error).not.toHaveProperty('retryable');
  expect(finish).toHaveBeenCalledExactlyOnceWith('http_error', status);
  expect(capture).not.toHaveBeenCalled();
  expect(reportErrorDiagnostic).not.toHaveBeenCalled();
});

it.each([
  ['malformed JSON', '{'],
  ['empty body', ''],
  ['HTML response', '<html>private gateway details</html>'],
  ['null payload', 'null'],
  ['missing reason', '{}'],
  ['non-string reason', '{"error":{"message":"private nested details"}}'],
  ['empty reason', '{"error":""}'],
  ['blank reason', '{"error":"  "}'],
])('keeps the HTTP status and a safe fallback for %s', async (_label, body) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 409 })));
  const error = await api('/user-input/question/answer', 'POST', {}).catch(
    (error: unknown) => error,
  );
  expect(error).toBeInstanceOf(ApiHttpError);
  expect(error).toMatchObject({ status: 409, message: 'Request failed.' });
  expect((error as ApiHttpError).serverMessage).toBeUndefined();
  expect(finish).toHaveBeenCalledExactlyOnceWith('http_error', 409);
});

it('preserves original network, abort and successful-payload parsing errors', async () => {
  const network = new TypeError('private network details');
  const abort = new DOMException('private abort details', 'AbortError');
  const malformed = new SyntaxError('private successful response details');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockRejectedValueOnce(network)
      .mockRejectedValueOnce(abort)
      .mockResolvedValueOnce({ status: 202, ok: true, json: () => Promise.reject(malformed) }),
  );
  await expect(api('/user-input/question/answer', 'POST', {})).rejects.toBe(network);
  await expect(api('/user-input/question/answer', 'POST', {})).rejects.toBe(abort);
  await expect(api('/user-input/question/answer', 'POST', {})).rejects.toBe(malformed);
  expect(finish.mock.calls).toEqual([
    ['network_error', undefined],
    ['aborted', undefined],
    ['invalid_response', 202],
  ]);
});

it('retains accepted payloads and keeps HTTP reason details out of diagnostic properties', async () => {
  const payload = { id: 'private continuation', userInputId: 'private question' };
  const reason = 'private server reason including private question';
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: reason }), { status: 500 })),
  );
  await expect(api('/user-input/question/answer', 'POST', {})).resolves.toEqual(payload);
  const error = await api('/user-input/question/answer', 'POST', {}).catch(
    (error: unknown) => error,
  );
  expect(error).toMatchObject({ status: 500, message: reason, serverMessage: reason });
  expect(reportErrorDiagnostic).toHaveBeenCalledWith(
    'api_action',
    error,
    'request_server',
    'question',
  );
  const diagnostic = vi.fn();
  createErrorReporter(diagnostic, () => true)('api_action', error, 'request_server', 'question');
  expect(diagnostic).toHaveBeenCalledOnce();
  expect(JSON.stringify(diagnostic.mock.calls)).not.toContain('private');
  expect(JSON.stringify(capture.mock.calls)).not.toContain('private');
});
