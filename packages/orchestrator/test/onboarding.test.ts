import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Snapshot } from '@pitchcrew/core';
import { afterEach, describe, expect, it } from 'vitest';
import { OnboardingPreferences } from '../src/onboarding.ts';
import { cleanup, setup } from './helpers/daemon.ts';

const directories: string[] = [];
async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'pitchcrew-onboarding-test-'));
  directories.push(path);
  return path;
}
afterEach(async () => {
  await cleanup();
  for (const path of directories.splice(0)) {
    if (!resolve(path).startsWith(resolve(tmpdir(), 'pitchcrew-onboarding-test-')))
      throw new Error('Refusing unsafe cleanup target.');
    await rm(path, { recursive: true, force: true });
  }
});

describe('workspace onboarding', () => {
  it('persists the welcome step, setup, completion and dismissal across restarts', async () => {
    const path = await directory();
    const preferences = new OnboardingPreferences(path);
    expect(preferences.get()).toEqual({ version: 1, status: 'welcome', step: 0 });
    for (const state of [
      { version: 1, status: 'welcome', step: 1 },
      { version: 1, status: 'setup', step: 0 },
      { version: 1, status: 'completed', step: 0 },
      { version: 1, status: 'dismissed', step: 0 },
    ]) {
      preferences.save(state);
      expect(new OnboardingPreferences(path).get()).toEqual(state);
    }
    expect(JSON.parse(await readFile(join(path, 'onboarding.json'), 'utf8'))).toEqual(
      preferences.get(),
    );
  });

  it('does not interrupt existing workspaces and still allows reopening the guide', async () => {
    const path = await directory();
    await writeFile(join(path, 'pitchcrew.db'), 'existing workspace marker');
    const preferences = new OnboardingPreferences(path);
    expect(preferences.get().status).toBe('dismissed');
    preferences.save({ version: 1, status: 'welcome', step: 0 });
    expect(new OnboardingPreferences(path).get().status).toBe('welcome');
  });

  it('validates user decisions, shares them in snapshots and leaves board rules untouched', async () => {
    const { daemon, request } = await setup(15270, false, { dev: false });
    const before = await daemon.service.snapshot();
    expect(before.onboarding?.status).toBe('welcome');
    const state = { version: 1, status: 'setup', step: 0 };
    expect((await request('/onboarding', 'PUT', state)).response.status).toBe(200);
    expect((await request<Snapshot>('/snapshot')).result.onboarding).toEqual(state);
    for (const input of [
      null,
      {},
      { ...state, version: 2 },
      { ...state, step: 2 },
      { ...state, status: 'unknown' },
      { ...state, enabled: true },
    ]) {
      expect((await request('/onboarding', 'PUT', input)).response.status).toBe(400);
      expect(daemon.service.onboarding.get()).toEqual(state);
    }
    const blocked = await daemon.app.inject({
      method: 'PUT',
      url: '/api/onboarding',
      payload: { ...state, status: 'completed' },
      headers: { host: new URL(daemon.url).host, 'x-pitchcrew-client': 'ui' },
    });
    expect(blocked.statusCode).toBe(403);
    expect(daemon.service.onboarding.get()).toEqual(state);
    const after = await daemon.service.snapshot();
    expect(after.events).toEqual(before.events);
    expect(after.roles).toEqual(before.roles);
    expect(after.runs).toEqual([]);
    expect(after.approvals).toEqual([]);
  });
});
