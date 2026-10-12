import { afterEach, expect, it, vi } from 'vitest';
import type { AppUpdateInfo, DesktopUpdateBridge, DesktopUpdateState } from '@pitchcrew/core';
import { api } from '../../api.ts';
import { createWorkspaceStore } from '../index.ts';
const capture = vi.hoisted(() => vi.fn());
vi.mock('../../Analytics/client.ts', () => ({ analytics: { capture } }));

vi.mock('@/api.ts', () => ({ api: vi.fn() }));
vi.mock('../../api.ts', () => ({ api: vi.fn() }));
vi.mock('@/chat-stream.ts', () => ({ subscribeChatStream: vi.fn() }));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const available: AppUpdateInfo = {
  current: { version: '0.1.0', commit: 'a'.repeat(40), packaged: true },
  automatic: true,
  status: 'available',
  checkedAt: '2026-10-06T00:00:00Z',
  latest: {
    commit: 'b'.repeat(40),
    url: 'https://github.com/HitBox38/PitchCrew/releases/tag/build-' + 'b'.repeat(40),
  },
  message: 'A newer Pitchcrew build is available.',
};

it('deduplicates manual checks and exposes progress without marking the workspace busy', async () => {
  let resolve!: (value: AppUpdateInfo) => void;
  vi.mocked(api).mockReturnValue(
    new Promise<AppUpdateInfo>((done) => {
      resolve = done;
    }),
  );
  const store = createWorkspaceStore();
  const first = store.getState().checkAppUpdate();
  const second = store.getState().checkAppUpdate();
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith('/app-updates/check?manual=true', 'POST');
  expect(store.getState()).toMatchObject({ checkingAppUpdate: true, working: false });
  resolve(available);
  await Promise.all([first, second]);
  expect(store.getState()).toMatchObject({ checkingAppUpdate: false, appUpdate: available });
});

it('dismisses only the displayed build and keeps manual checking available', async () => {
  const store = createWorkspaceStore();
  store.setState({ appUpdate: available });
  store.getState().dismissAppUpdate();
  expect(store.getState().dismissedAppUpdate).toBe(available.latest!.commit);
  const next = { ...available, latest: { ...available.latest!, commit: 'c'.repeat(40) } };
  vi.mocked(api).mockResolvedValue(next);
  await store.getState().checkAppUpdate(false);
  expect(api).toHaveBeenCalledWith('/app-updates/check', 'POST');
  expect(store.getState().appUpdate?.latest?.commit).not.toBe(store.getState().dismissedAppUpdate);
});

it('clears progress after connection failures and can retry initial loading', async () => {
  const store = createWorkspaceStore();
  vi.mocked(api).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(available);
  await store.getState().loadAppUpdate();
  expect(store.getState()).toMatchObject({ checkingAppUpdate: false, appUpdate: null });
  expect(store.getState().appUpdateError).toContain('local daemon');
  await store.getState().loadAppUpdate();
  await store.getState().loadAppUpdate();
  expect(api).toHaveBeenCalledTimes(2);
  expect(store.getState()).toMatchObject({ appUpdate: available, appUpdateError: '' });
});

it('keeps automatic checks dismissed and restores an available build on a manual check', async () => {
  const store = createWorkspaceStore();
  store.setState({ appUpdate: available });
  store.getState().dismissAppUpdate();
  vi.mocked(api).mockResolvedValue(available);
  await store.getState().checkAppUpdate(false);
  expect(store.getState().dismissedAppUpdate).toBe(available.latest!.commit);
  await store.getState().checkAppUpdate();
  expect(store.getState().dismissedAppUpdate).toBeNull();
});

it('preserves dismissal when a manual check fails with a previous available result', async () => {
  const store = createWorkspaceStore();
  store.setState({ appUpdate: available });
  store.getState().dismissAppUpdate();
  vi.mocked(api).mockRejectedValue(new Error('offline'));
  await store.getState().checkAppUpdate();
  expect(store.getState().dismissedAppUpdate).toBe(available.latest!.commit);
  expect(store.getState().appUpdateError).toContain('local daemon');
});

it('restores an available build when a manual check joins an automatic check', async () => {
  let resolve!: (value: AppUpdateInfo) => void;
  vi.mocked(api).mockReturnValue(
    new Promise<AppUpdateInfo>((done) => {
      resolve = done;
    }),
  );
  const store = createWorkspaceStore();
  store.setState({ appUpdate: available });
  store.getState().dismissAppUpdate();
  const automatic = store.getState().checkAppUpdate(false);
  const manual = store.getState().checkAppUpdate();
  resolve(available);
  await Promise.all([automatic, manual]);
  expect(api).toHaveBeenCalledTimes(1);
  expect(store.getState().dismissedAppUpdate).toBeNull();
});

it('shares native updater state and actions while retaining browser release information', async () => {
  const state: DesktopUpdateState = {
    enabled: true,
    currentVersion: '0.1.0',
    status: 'available',
    availableVersion: '0.2.0',
    downloadedVersion: null,
    downloadPercent: null,
    checkedAt: null,
    message: 'Ready to download.',
  };
  const downloaded = { ...state, status: 'downloaded' as const, downloadedVersion: '0.2.0' };
  const bridge: DesktopUpdateBridge = {
    getState: vi.fn(async () => state),
    check: vi.fn(async () => state),
    download: vi.fn(async () => downloaded),
    install: vi.fn(async () => downloaded),
    subscribe: vi.fn(() => () => {}),
  };
  vi.stubGlobal('window', { pitchcrewUpdates: bridge });
  vi.mocked(api).mockResolvedValue(available);
  const store = createWorkspaceStore();
  await store.getState().loadAppUpdate();
  expect(store.getState().desktopUpdate).toEqual(state);
  store.getState().dismissAppUpdate();
  expect(store.getState().dismissedAppUpdate).toBe('0.2.0');
  await store.getState().checkAppUpdate(false);
  expect(store.getState().dismissedAppUpdate).toBe('0.2.0');
  await store.getState().checkAppUpdate();
  expect(store.getState().dismissedAppUpdate).toBeNull();
  expect(bridge.check).toHaveBeenCalledTimes(2);
  await store.getState().downloadDesktopUpdate();
  expect(store.getState().desktopUpdate?.downloadedVersion).toBe('0.2.0');
  await store.getState().installDesktopUpdate();
  expect(bridge.install).toHaveBeenCalledTimes(1);
});

it('captures native acceptance before restart and excludes hydration, progress and cancelled installs', async () => {
  const downloaded: DesktopUpdateState = {
    enabled: true,
    currentVersion: '0.2.0',
    status: 'downloaded',
    availableVersion: '0.3.0',
    downloadedVersion: '0.3.0',
    downloadPercent: 100,
    checkedAt: null,
    message: 'Private',
  };
  const bridge = { install: vi.fn(async () => downloaded) };
  vi.stubGlobal('window', { pitchcrewUpdates: bridge });
  const store = createWorkspaceStore();
  store.getState().setDesktopUpdate(downloaded);
  await store.getState().installDesktopUpdate();
  expect(capture).not.toHaveBeenCalled();
  store.getState().setDesktopUpdate({ ...downloaded, status: 'installing' });
  store
    .getState()
    .setDesktopUpdate({ ...downloaded, status: 'installing', message: 'Private progress' });
  expect(capture).toHaveBeenCalledExactlyOnceWith('app_update_install_requested');
  capture.mockClear();
  store
    .getState()
    .setDesktopUpdate({ ...downloaded, status: 'available', downloadedVersion: null });
  store.getState().setDesktopUpdate({ ...downloaded, status: 'downloading', downloadPercent: 0 });
  store.getState().setDesktopUpdate({ ...downloaded, status: 'downloading', downloadPercent: 70 });
  store.getState().setDesktopUpdate(downloaded);
  expect(capture).toHaveBeenCalledExactlyOnceWith('app_update_download_requested');
});
