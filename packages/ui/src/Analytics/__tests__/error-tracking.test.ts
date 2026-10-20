import { describe, expect, it, vi } from 'vitest';
import { createAnalytics, sdkConfig } from '../client.ts';
import { sanitizeEvent } from '../helpers.ts';
import { errorCategories, errorSources, sanitizeException } from '../error-sanitizer.ts';
import { apiErrorAction, createErrorReporter, installErrorTracking } from '../error-tracking.ts';

describe('private exception capture', () => {
  it('never copies error text, custom names, stack frames, causes or nested SDK properties', () => {
    const capture = vi.fn();
    const report = createErrorReporter(capture, () => true);
    const error = new TypeError('answer=secret /Users/private/resume.pdf');
    error.name = 'private-name';
    error.stack = 'https://private.example/secret?token=private';
    error.cause = new Error('secret cause');
    report('react_boundary', error);
    const properties = capture.mock.calls[0][1];
    const event = sanitizeEvent({
      event: '$exception',
      properties: {
        ...properties,
        message: error.message,
        stack: error.stack,
        $current_url: error.stack,
        $exception_list: [
          {
            type: error.name,
            value: error.message,
            stacktrace: { frames: [{ filename: error.stack }] },
          },
        ],
        $exception_fingerprint: 'secret fingerprint',
        $issue_name: 'secret issue',
      },
    });
    expect(event?.properties).toEqual({
      ...properties,
      $process_person_profile: false,
      $geoip_disable: true,
    });
    expect(properties.$exception_list).toEqual([
      {
        type: 'type_error',
        value: 'Pitchcrew react_boundary: type_error',
        mechanism: { type: 'react_boundary', handled: true, synthetic: true },
      },
    ]);
    expect(JSON.stringify(event)).not.toMatch(/secret|private|stacktrace|filename/);
    expect(error.message).toContain('secret');
  });

  it('drops unknown categories/sources and rebuilds fixed action fingerprints', () => {
    expect(
      sanitizeException({ error_source: 'custom-role', error_category: 'generic_error' }),
    ).toBeNull();
    expect(
      sanitizeException({ error_source: 'window_error', error_category: 'private exception' }),
    ).toBeNull();
    expect(
      sanitizeException({
        error_source: 'api_action',
        error_category: 'request_server',
        error_action: 'private-id',
      }),
    ).toBeNull();
    const sanitized = sanitizeException({
      error_source: 'api_action',
      error_category: 'request_server',
      error_action: 'chat',
      status: 500,
      path: '/private',
    });
    expect(sanitized?.$exception_fingerprint).toBe('pitchcrew-v1:api_action:request_server:chat');
    expect(sanitized).not.toHaveProperty('path');
    expect(sanitized).not.toHaveProperty('status');
  });

  it('does not inspect arbitrary objects, messages or rejection strings', () => {
    const capture = vi.fn();
    const report = createErrorReporter(capture, () => true);
    const hostile = {
      get message() {
        throw new Error('must not read');
      },
      get name() {
        throw new Error('must not read');
      },
      get stack() {
        throw new Error('must not read');
      },
    };
    expect(() => report('unhandled_rejection', hostile)).not.toThrow();
    report('window_error', 'private rejection');
    expect(capture).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(capture.mock.calls)).not.toContain('private');
    const proxy = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error('private');
        },
      },
    );
    expect(() => report('window_error', proxy)).not.toThrow();
  });

  it('drops disabled reports without consuming deduplication and never throws transport failures', () => {
    let enabled = false;
    const capture = vi.fn();
    const report = createErrorReporter(capture, () => enabled);
    const error = new Error('private');
    report('window_error', error);
    expect(capture).not.toHaveBeenCalled();
    enabled = true;
    report('window_error', error);
    expect(capture).toHaveBeenCalledOnce();
    enabled = false;
    report('react_boundary', new Error('private'));
    expect(capture).toHaveBeenCalledOnce();
    const broken = createErrorReporter(
      () => {
        throw error;
      },
      () => true,
    );
    expect(() => broken('window_error', error)).not.toThrow();
  });

  it('deduplicates root/browser reports for an object and bounds reports per minute', () => {
    let now = 100_000;
    const capture = vi.fn();
    const report = createErrorReporter(
      capture,
      () => true,
      () => now,
    );
    const error = new Error('private');
    report('react_uncaught', error);
    report('window_error', error);
    expect(capture).toHaveBeenCalledOnce();
    for (const source of errorSources.filter((source) => source !== 'api_action'))
      for (const category of errorCategories) report(source, new Error('private'), category);
    expect(capture).toHaveBeenCalledTimes(20);
    now += 60_000;
    report('window_error', new Error('private'));
    expect(capture).toHaveBeenCalledTimes(21);
    report('window_error', new Error('different private text'));
    expect(capture).toHaveBeenCalledTimes(21);
  });

  it('keeps the SDK generic exception capture disabled and rechecks both preferences before send', async () => {
    const sdk = {
      init: vi.fn(),
      capture: vi.fn(),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
    };
    let consent = true;
    let diagnostics = true;
    const analytics = createAnalytics(
      async () => sdk,
      () => consent,
      () => diagnostics,
    );
    const report = createErrorReporter(
      (event, properties) => analytics.captureDiagnostic(event, properties),
      () => analytics.diagnosticsEnabled(),
    );
    report('react_boundary', new Error('startup error'));
    expect(sdk.capture).not.toHaveBeenCalled();
    await analytics.setEnabled(true, { token: 'fixture', host: 'https://eu.i.posthog.com' });
    report('react_boundary', new Error('private'));
    expect(sdk.capture).toHaveBeenCalledOnce();
    expect(sdkConfig.capture_exceptions).toBe(false);
    const beforeSend = sdk.init.mock.calls[0][1].before_send;
    const event = { event: '$exception', properties: sdk.capture.mock.calls[0][1] };
    expect(beforeSend(event)).not.toBeNull();
    diagnostics = false;
    expect(beforeSend(event)).toBeNull();
    report('window_error', new Error('private'));
    expect(sdk.capture).toHaveBeenCalledOnce();
    diagnostics = true;
    consent = false;
    expect(beforeSend(event)).toBeNull();
    expect(analytics.diagnosticsEnabled()).toBe(false);
  });

  it('installs removable listeners without cancelling normal browser error reporting', () => {
    const target = new EventTarget();
    const report = vi.fn();
    const remove = installErrorTracking(target as unknown as Window, report);
    const error = new Event('error', { cancelable: true });
    Object.defineProperty(error, 'error', { value: new Error('private') });
    const rejection = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(rejection, 'reason', { value: 'private' });
    expect(target.dispatchEvent(error)).toBe(true);
    expect(target.dispatchEvent(rejection)).toBe(true);
    expect(report.mock.calls.map(([source]) => source)).toEqual([
      'window_error',
      'unhandled_rejection',
    ]);
    remove();
    target.dispatchEvent(error);
    expect(report).toHaveBeenCalledTimes(2);
    const removeAgain = installErrorTracking(target as unknown as Window, report);
    target.dispatchEvent(error);
    expect(report).toHaveBeenCalledTimes(3);
    removeAgain();
  });

  it('maps supported deliberate action events to a closed domain vocabulary', () => {
    expect(apiErrorAction('chat_sent')).toBe('chat');
    expect(apiErrorAction('applications_imported')).toBe('application');
    expect(apiErrorAction('packet_exported')).toBe('approval');
    expect(apiErrorAction('pipeline_followup_saved')).toBe('pipeline');
    expect(apiErrorAction('$pageview')).toBeUndefined();
    expect(apiErrorAction(undefined)).toBeUndefined();
  });
});
