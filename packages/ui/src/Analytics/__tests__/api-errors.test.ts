import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api.ts';
import { analytics } from '../client.ts';
import { reportErrorDiagnostic } from '../error-tracking.ts';

vi.mock('../client.ts', () => ({ analytics: { capture: vi.fn() } }));
vi.mock('../error-tracking.ts', async (original) => ({
  ...(await original<typeof import('../error-tracking.ts')>()),
  reportErrorDiagnostic: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('deliberate API action exceptions', () => {
  it('preserves network errors and only records a fixed action classification', async () => {
    const error = new TypeError('private network details');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    await expect(
      api('/conversations/private-thread/messages', 'POST', { content: 'private answer' }),
    ).rejects.toBe(error);
    expect(reportErrorDiagnostic).toHaveBeenCalledExactlyOnceWith(
      'api_action',
      error,
      'request_network',
      'chat',
    );
    expect(analytics.capture).not.toHaveBeenCalled();
  });

  it('reports server errors while returning the original user-facing message', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'private error details' }), { status: 500 }),
        ),
    );
    await expect(api('/profile', 'PUT', { notes: 'private profile' })).rejects.toThrow(
      'private error details',
    );
    expect(reportErrorDiagnostic).toHaveBeenCalledWith(
      'api_action',
      expect.any(Error),
      'request_server',
      'profile',
    );
  });

  it('reports malformed successful action responses without replacing the parsing error', async () => {
    const error = new SyntaxError('private response');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, ok: true, json: vi.fn().mockRejectedValue(error) }),
    );
    await expect(api('/cards', 'POST', { notes: 'private' })).rejects.toBe(error);
    expect(reportErrorDiagnostic).toHaveBeenCalledExactlyOnceWith(
      'api_action',
      error,
      'request_response',
      'job',
    );
  });

  it('excludes expected 4xx failures, polling, browser input/control renewal and cancellation', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'Expected validation' }), { status: 400 }),
      );
    vi.stubGlobal('fetch', fetch);
    await expect(api('/profile', 'PUT', {})).rejects.toThrow('Expected validation');
    fetch.mockRejectedValue(new Error('private'));
    await expect(api('/snapshot')).rejects.toThrow();
    await expect(api('/browser/private/input', 'POST', { text: 'private' })).rejects.toThrow();
    await expect(api('/browser/private/control', 'POST', { operation: 'renew' })).rejects.toThrow();
    const controller = new AbortController();
    controller.abort();
    await expect(api('/cards', 'POST', {}, controller.signal)).rejects.toThrow();
    expect(reportErrorDiagnostic).not.toHaveBeenCalled();
  });

  it('retains normal response and success telemetry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'private-id' }))),
    );
    expect(await api('/conversations/private/messages', 'POST', { content: 'private' })).toEqual({
      id: 'private-id',
    });
    expect(analytics.capture).toHaveBeenCalledExactlyOnceWith('chat_sent', undefined);
    expect(reportErrorDiagnostic).not.toHaveBeenCalled();
  });
});
