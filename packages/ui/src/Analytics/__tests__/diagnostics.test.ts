import { describe, expect, it, vi } from 'vitest';
import { sanitizeDiagnostic } from '../diagnostics.ts';
import { sanitizeEvent } from '../helpers.ts';
import { createAnalytics } from '../client.ts';

describe('diagnostic default boundary', () => {
  it('drops unknown events before capture and again at the SDK outbound boundary', async () => {
    const sdk = {
      init: vi.fn(),
      capture: vi.fn(),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
    };
    const analytics = createAnalytics(async () => sdk);
    await analytics.setEnabled(true, { token: 'fixture', host: 'https://eu.i.posthog.com' });
    analytics.captureDiagnostic('$exception', { message: 'private path', stack: 'private' });
    analytics.captureDiagnostic('constructor', { message: 'private' });
    expect(sdk.capture).not.toHaveBeenCalled();
    expect(sanitizeDiagnostic('$exception', {})).toBeNull();
    expect(sanitizeEvent({ event: '$exception', properties: { message: 'private' } })).toBeNull();
    expect(
      sdk.init.mock.calls[0][1].before_send({ event: '$exception', properties: {} }),
    ).toBeNull();
  });
});
