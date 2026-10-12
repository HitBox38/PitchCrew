import type { Card, Role, Snapshot } from '@pitchcrew/core';
import { describe, expect, it, vi } from 'vitest';
import { productSetupProperties } from '../product.ts';
import { sanitizeEvent } from '../helpers.ts';
import { createAnalytics } from '../client.ts';

const data = {
  profile: [{ name: 'private-path.md', content: 'Private profile notes' }],
  cards: [{ id: 'private-job', sample: true } as Card],
  roles: (['scout', 'writer', 'reviewer'] as const).map(
    (workflow) =>
      ({
        id: `private-${workflow}`,
        workflow,
        runtime: 'codex',
        enabled: true,
      }) as Role,
  ),
  runtimes: [{ id: 'codex', available: true }],
} as unknown as Snapshot;

describe('product setup observations', () => {
  it('reuses readiness rules and exposes only three booleans without replaying saved actions', () => {
    expect(productSetupProperties(null)).toBeUndefined();
    expect(productSetupProperties(data)).toEqual({
      profile_ready: true,
      crew_ready: true,
      job_ready: false,
    });
    expect(productSetupProperties({ ...data, cards: [{ sample: false } as Card] })).toEqual({
      profile_ready: true,
      crew_ready: true,
      job_ready: true,
    });
    expect(productSetupProperties({ ...data, runtimes: [] })?.crew_ready).toBe(false);
    expect(
      sanitizeEvent({
        event: 'workspace_setup_observed',
        properties: { ...data, ...productSetupProperties(data) },
      })?.properties,
    ).toEqual({
      profile_ready: true,
      crew_ready: true,
      job_ready: false,
      $geoip_disable: true,
      $process_person_profile: false,
    });
  });

  it('deduplicates snapshot observations per enabled session and rechecks the master consent', async () => {
    const sdk = {
      init: vi.fn(),
      capture: vi.fn(),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
    };
    let consent = true;
    const analytics = createAnalytics(
      async () => sdk,
      () => consent,
    );
    const config = { token: 'fixture', host: 'https://eu.i.posthog.com' };
    const setup = productSetupProperties(data)!;
    analytics.capture('workspace_setup_observed', setup);
    expect(sdk.capture).not.toHaveBeenCalled();
    await analytics.setEnabled(true, config);
    analytics.capture('workspace_setup_observed', setup);
    analytics.capture('workspace_setup_observed', { ...setup });
    analytics.capture('workspace_setup_observed', { ...setup, job_ready: true });
    expect(sdk.capture).toHaveBeenCalledTimes(2);
    consent = false;
    analytics.capture('workspace_setup_observed', setup);
    expect(sdk.capture).toHaveBeenCalledTimes(2);
    consent = true;
    await analytics.setEnabled(false, config);
    await analytics.setEnabled(true, config);
    analytics.capture('workspace_setup_observed', setup);
    expect(sdk.capture).toHaveBeenCalledTimes(3);
    analytics.capture('workspace_setup_observed', { profile_ready: true });
    expect(sdk.capture).toHaveBeenCalledTimes(3);
  });
});
