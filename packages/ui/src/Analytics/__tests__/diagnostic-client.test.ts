import { describe, expect, it, vi } from 'vitest';

vi.mock('../diagnostics.ts', () => ({
  sanitizeDiagnostic: (event: string, properties: Record<string, unknown>) =>
    event === 'fixture_diagnostic' && properties.outcome === 'failed'
      ? { outcome: 'failed' }
      : null,
}));
import { createAnalytics } from '../client.ts';

describe('registered diagnostic lifecycle', () => {
  it('sanitizes before capture and rejects diagnostics immediately when either consent changes', async () => {
    const sdk = {
      init: vi.fn(),
      capture: vi.fn(),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
    };
    let master = true;
    let diagnostics = true;
    const analytics = createAnalytics(
      async () => sdk,
      () => master,
      () => diagnostics,
    );
    await analytics.setEnabled(true, { token: 'fixture', host: 'https://eu.i.posthog.com' });
    analytics.captureDiagnostic('fixture_diagnostic', { outcome: 'failed', message: 'private' });
    expect(sdk.capture).toHaveBeenCalledExactlyOnceWith(
      'fixture_diagnostic',
      expect.objectContaining({ outcome: 'failed' }),
    );
    expect(sdk.capture.mock.calls[0][1]).not.toHaveProperty('message');
    const pending = {
      event: 'fixture_diagnostic',
      properties: { outcome: 'failed', message: 'private' },
    };
    const beforeSend = sdk.init.mock.calls[0][1].before_send;
    expect(beforeSend(pending).properties).not.toHaveProperty('message');
    diagnostics = false;
    expect(beforeSend(pending)).toBeNull();
    analytics.captureDiagnostic('fixture_diagnostic', pending.properties);
    analytics.capture('chat_sent');
    expect(sdk.capture).toHaveBeenCalledTimes(2);
    diagnostics = true;
    master = false;
    analytics.captureDiagnostic('fixture_diagnostic', pending.properties);
    expect(beforeSend(pending)).toBeNull();
    expect(sdk.capture).toHaveBeenCalledTimes(2);
    master = true;
    await analytics.setEnabled(false, null);
    analytics.captureDiagnostic('fixture_diagnostic', pending.properties);
    expect(sdk.capture).toHaveBeenCalledTimes(2);
  });
});
