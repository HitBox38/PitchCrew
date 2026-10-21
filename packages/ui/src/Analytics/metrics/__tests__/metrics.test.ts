import { describe, expect, it, vi } from 'vitest';
import { startRequestMetric } from '../requests.ts';
import { createRunMetrics } from '../runs.ts';
import { sanitizeRequestMetric, sanitizeRunMetric } from '../sanitize.ts';
import { sanitizeEvent } from '../../helpers.ts';

describe('deliberate request metrics', () => {
  it('measures one action and strips route, request and response content', () => {
    const record = vi.fn();
    let clock = 12;
    const finish = startRequestMetric(
      '/conversations/private-thread/messages?secret=private',
      'POST',
      { content: 'private' },
      { record },
      () => true,
      () => clock,
    );
    clock = 99;
    finish('http_error', 409);
    finish('success');
    expect(record).toHaveBeenCalledExactlyOnceWith('api_request_finished', {
      operation: 'chat_sent',
      result: 'http_error',
      duration_ms: 87,
      http_status: 409,
    });
  });
  it('never measures automatic reads, previews, browser input or lease renewal', () => {
    const record = vi.fn();
    for (const path of [
      '/snapshot',
      '/analytics/config',
      '/telemetry/observations',
      '/profile/preview',
      '/browser/private/input',
      '/browser/private/control',
    ]) {
      startRequestMetric(
        path,
        path.includes('/browser/') ? 'POST' : 'GET',
        { operation: 'renew' },
        { record },
        () => true,
      )('success');
    }
    expect(record).not.toHaveBeenCalled();
  });
  it('does not retain a disabled measurement or emit when consent is revoked', () => {
    const record = vi.fn();
    let allowed = false;
    const disabled = startRequestMetric('/cards', 'POST', {}, { record }, () => allowed);
    allowed = true;
    disabled('success');
    const pending = startRequestMetric('/cards', 'POST', {}, { record }, () => allowed);
    allowed = false;
    pending('aborted');
    expect(record).not.toHaveBeenCalled();
  });
});

describe('session-observed run metrics', () => {
  const run = (
    id: string,
    status: 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled',
    startedAt = '2026-10-12T00:00:02Z',
    finishedAt: string | null = null,
  ) => ({ id, status, startedAt, finishedAt, mode: 'chat' as const });
  it('excludes history and unobserved completions, waits for a real terminal outcome and deduplicates snapshots', () => {
    const record = vi.fn();
    let clock = Date.parse('2026-10-12T00:00:01Z');
    const observer = createRunMetrics(
      { record },
      () => true,
      () => clock,
    );
    clock += 2000;
    observer.observe([
      run('old', 'running', '2026-10-11T23:59:00Z'),
      run('unobserved', 'completed'),
      run('new', 'running'),
    ]);
    observer.observe([run('new', 'waiting')]);
    expect(record).not.toHaveBeenCalled();
    clock += 2000;
    const completed = run('new', 'completed', undefined, '2026-10-12T00:00:04Z');
    observer.observe([completed, run('old', 'completed')]);
    observer.observe([completed]);
    expect(record).toHaveBeenCalledExactlyOnceWith('run_finished', {
      mode: 'chat',
      outcome: 'completed',
      duration_ms: 2000,
    });
  });
  it('counts failures without inventing a duration from a missing or invalid finish time', () => {
    const record = vi.fn();
    let clock = Date.parse('2026-10-12T00:00:01Z');
    const observer = createRunMetrics(
      { record },
      () => true,
      () => clock,
    );
    clock += 3000;
    observer.observe([run('a', 'running'), run('b', 'running')]);
    observer.observe([
      run('a', 'failed'),
      run('b', 'cancelled', undefined, '2026-10-11T00:00:00Z'),
    ]);
    expect(record.mock.calls.map((call) => call[1])).toEqual([
      { mode: 'chat', outcome: 'failed' },
      { mode: 'chat', outcome: 'cancelled' },
    ]);
  });
  it('resets observation on revoked consent and caps local correlation without evicting deduplication', () => {
    const record = vi.fn();
    let allowed = true;
    let clock = Date.parse('2026-10-12T00:00:01Z');
    const observer = createRunMetrics(
      { record },
      () => allowed,
      () => clock,
      1,
    );
    clock += 2000;
    observer.observe([run('a', 'running'), run('b', 'running')]);
    observer.observe([run('a', 'failed'), run('b', 'failed')]);
    expect(record).toHaveBeenCalledTimes(1);
    observer.observe([run('a', 'running')]);
    observer.observe([run('a', 'failed')]);
    expect(record).toHaveBeenCalledTimes(1);
    allowed = false;
    observer.observe([]);
    allowed = true;
    observer.observe([run('a', 'running')]);
    observer.observe([run('a', 'failed')]);
    expect(record).toHaveBeenCalledTimes(1);
  });
});

it('rebuilds diagnostic properties at both input and outbound boundaries', () => {
  expect(
    sanitizeRequestMetric({ operation: '/private/path', result: 'success', duration_ms: 12 }),
  ).toBeNull();
  expect(
    sanitizeRequestMetric({ operation: 'chat_sent', result: 'success', duration_ms: Infinity }),
  ).toBeNull();
  expect(sanitizeRunMetric({ mode: 'custom-private-role', outcome: 'failed' })).toBeNull();
  expect(
    sanitizeEvent({
      event: 'run_finished',
      properties: {
        mode: 'chat',
        outcome: 'failed',
        message: 'private',
        runId: 'secret',
        duration_ms: -1,
      },
    })?.properties,
  ).toEqual({
    $process_person_profile: false,
    $geoip_disable: true,
    mode: 'chat',
    outcome: 'failed',
  });
  expect(
    sanitizeEvent(
      {
        event: 'api_request_finished',
        properties: {
          operation: 'chat_sent',
          result: 'aborted',
          duration_ms: 12,
          url: 'private',
          body: 'secret',
        },
      },
      false,
    ),
  ).toBeNull();
});
