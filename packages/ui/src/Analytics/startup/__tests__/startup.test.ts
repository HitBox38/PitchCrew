import { expect, it, vi } from 'vitest';
import { createStartupTracker } from '../tracker.ts';
import { sanitizeEvent } from '../../helpers.ts';
import { createAnalytics } from '../../client.ts';
const fixture = () => {
  let allowed = true;
  let enabled = false;
  const read = vi.fn(async (): Promise<unknown> => timing);
  const capture = vi.fn();
  const tracker = createStartupTracker({
    read,
    capture,
    allowed: () => allowed,
    enabled: () => enabled,
  });
  return {
    read,
    capture,
    tracker,
    consent: (next: boolean) => {
      allowed = next;
    },
    enable: () => {
      enabled = true;
    },
  };
};

const timing = { duration_ms: 6000, daemon_ready_ms: 4000 };

it('freezes readiness before SDK initialization and captures once across repeat commits and flushes', async () => {
  const f = fixture();
  await f.tracker.ready();
  await f.tracker.ready();
  expect(f.capture).not.toHaveBeenCalled();
  f.enable();
  f.tracker.flush();
  f.tracker.flush();
  expect(f.read).toHaveBeenCalledOnce();
  expect(f.capture).toHaveBeenCalledExactlyOnceWith('app_startup_finished', timing);
});

it('drops a pending native read permanently on consent revocation, including re-enable', async () => {
  const f = fixture();
  let finish!: (value: unknown) => void;
  f.read.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = f.tracker.ready();
  f.consent(false);
  f.tracker.discard();
  f.consent(true);
  f.enable();
  finish(timing);
  await pending;
  f.tracker.flush();
  await f.tracker.ready();
  expect(f.capture).not.toHaveBeenCalled();
});

it.each([
  null,
  { duration_ms: -1, daemon_ready_ms: 0 },
  { duration_ms: Infinity, daemon_ready_ms: 1 },
  { duration_ms: 10, daemon_ready_ms: 11 },
  { duration_ms: 86_400_001, daemon_ready_ms: 1 },
])('ignores unavailable or invalid launch timing %j', async (value) => {
  const f = fixture();
  f.read.mockResolvedValue(value);
  f.enable();
  await f.tracker.ready();
  expect(f.capture).not.toHaveBeenCalled();
});

it('only sends reviewed numbers and rechecks both consent gates at the SDK boundary', async () => {
  let allowed = true;
  const sdk = {
    init: vi.fn(),
    capture: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
  };
  const analytics = createAnalytics(
    async () => sdk,
    () => allowed,
    () => allowed,
  );
  await analytics.setEnabled(true, { token: 'fixture', host: 'https://eu.i.posthog.com' });
  analytics.captureDiagnostic('app_startup_finished', {
    ...timing,
    path: '/private',
    platform: 'private',
  });
  expect(sdk.capture).toHaveBeenCalledOnce();
  const event = { event: 'app_startup_finished', properties: { ...timing, path: '/private' } };
  expect(sanitizeEvent(event)?.properties).not.toHaveProperty('path');
  allowed = false;
  expect(sdk.init.mock.calls[0][1].before_send(event)).toBeNull();
});
