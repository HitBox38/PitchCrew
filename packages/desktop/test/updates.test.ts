import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
import {
  createDesktopUpdater,
  type UpdateDependencies,
  type UpdateDriver,
} from '../src/updates/controller.ts';
import { trustedUpdateSender } from '../src/updates/ipc.ts';
import type { IpcMainInvokeEvent } from 'electron';

function fixture(overrides: Partial<UpdateDependencies> = {}) {
  const events = new EventEmitter();
  const driver: UpdateDriver = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowDowngrade: true,
    on: events.on.bind(events),
    checkForUpdates: vi.fn(async () => ({
      updateInfo: { version: '0.2.0' },
      isUpdateAvailable: true,
    })),
    downloadUpdate: vi.fn(async () => ['/fixture/installer']),
    quitAndInstall: vi.fn(),
  };
  const deps = {
    version: '0.1.0',
    disabledReason: null,
    driver,
    emit: vi.fn(),
    confirm: vi.fn(async () => true),
    prepare: vi.fn(async () => {}),
    recover: vi.fn(async () => {}),
    installing: vi.fn(),
    ...overrides,
  };
  return { events, deps, driver, updates: createDesktopUpdater(deps) };
}

it('checks without downloading, then downloads without stopping work, and confirms before installing', async () => {
  const { updates, driver, deps } = fixture();
  expect(driver).toMatchObject({
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowDowngrade: false,
  });
  await updates.install();
  await updates.download();
  expect(deps.confirm).not.toHaveBeenCalled();
  expect(driver.downloadUpdate).not.toHaveBeenCalled();
  await updates.check();
  expect(updates.getState().status).toBe('available');
  expect(driver.downloadUpdate).not.toHaveBeenCalled();
  await updates.download();
  expect(updates.getState()).toMatchObject({ status: 'downloaded', downloadedVersion: '0.2.0' });
  expect(deps.prepare).not.toHaveBeenCalled();
  await updates.install();
  expect(deps.confirm).toHaveBeenCalledWith('0.2.0');
  expect(driver.quitAndInstall).toHaveBeenCalledWith(true, true);
  expect(vi.mocked(deps.confirm).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(deps.prepare).mock.invocationCallOrder[0],
  );
  expect(vi.mocked(deps.prepare).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(driver.quitAndInstall).mock.invocationCallOrder[0],
  );
  await updates.install();
  expect(driver.quitAndInstall).toHaveBeenCalledTimes(1);
});

it('cancelling confirmation leaves the downloaded update and active daemon untouched', async () => {
  const { updates, deps, driver } = fixture({ confirm: vi.fn(async () => false) });
  await updates.check();
  await updates.download();
  await updates.install();
  expect(updates.getState().status).toBe('downloaded');
  expect(deps.prepare).not.toHaveBeenCalled();
  expect(driver.quitAndInstall).not.toHaveBeenCalled();
});

it('serializes downloads and reports progress without permitting install during download', async () => {
  const { updates, driver, events, deps } = fixture();
  let finish!: (files: string[]) => void;
  vi.mocked(driver.downloadUpdate).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await updates.check();
  const download = updates.download();
  events.emit('download-progress', { percent: 37.4 });
  expect(updates.getState().downloadPercent).toBe(37);
  await updates.download();
  await updates.install();
  await updates.check();
  expect(driver.downloadUpdate).toHaveBeenCalledTimes(1);
  expect(deps.confirm).not.toHaveBeenCalled();
  finish(['/fixture']);
  await download;
});

it('keeps failed downloads un-installable and allows a successful retry', async () => {
  const { updates, driver, deps } = fixture();
  vi.mocked(driver.downloadUpdate).mockRejectedValueOnce(new Error('checksum mismatch'));
  await updates.check();
  await updates.download();
  await updates.install();
  expect(updates.getState()).toMatchObject({ status: 'error', downloadedVersion: null });
  expect(deps.prepare).not.toHaveBeenCalled();
  await updates.download();
  expect(updates.getState().status).toBe('downloaded');
});

it('recovers a partially stopped daemon when preparation fails and retries the same downloaded version', async () => {
  const prepare = vi.fn(async () => {}).mockRejectedValueOnce(new Error('stop timed out'));
  const { updates, deps, driver } = fixture({ prepare });
  await updates.check();
  await updates.download();
  await updates.install();
  expect(deps.recover).toHaveBeenCalledTimes(1);
  expect(driver.quitAndInstall).not.toHaveBeenCalled();
  expect(updates.getState()).toMatchObject({ status: 'error', downloadedVersion: '0.2.0' });
  await updates.check();
  expect(driver.checkForUpdates).toHaveBeenCalledTimes(1);
  await updates.install();
  expect(driver.quitAndInstall).toHaveBeenCalledTimes(1);
});

it('recovers updater-reported installation errors as well as thrown errors', async () => {
  const { updates, driver, events, deps } = fixture();
  vi.mocked(driver.quitAndInstall).mockImplementation(() => {
    events.emit('error', new Error('installer failed'));
  });
  await updates.check();
  await updates.download();
  await updates.install();
  await vi.waitFor(() => expect(updates.getState().status).toBe('error'));
  expect(deps.recover).toHaveBeenCalledTimes(1);
  expect(updates.getState().downloadedVersion).toBe('0.2.0');
});

it('recovers only once when the installer emits an error and throws for the same failure', async () => {
  const { updates, driver, events, deps } = fixture();
  vi.mocked(driver.quitAndInstall).mockImplementation(() => {
    events.emit('error', new Error('installer failed'));
    throw new Error('installer failed');
  });
  await updates.check();
  await updates.download();
  await updates.install();
  expect(deps.recover).toHaveBeenCalledTimes(1);
  expect(updates.getState()).toMatchObject({ status: 'error', downloadedVersion: '0.2.0' });
});

it('disabled builds remain offline for all bridge actions', async () => {
  const { updates, driver, deps } = fixture({ disabledReason: 'Unsigned Mac build' });
  await updates.check();
  await updates.download();
  await updates.install();
  expect(updates.getState()).toMatchObject({ enabled: false, status: 'disabled' });
  expect(driver.checkForUpdates).not.toHaveBeenCalled();
  expect(deps.prepare).not.toHaveBeenCalled();
});

it('denies update IPC from child frames, other windows, cross-origin pages and malformed URLs', () => {
  const frame = { url: 'http://127.0.0.1:4417/settings' };
  const contents = { mainFrame: frame };
  const trusted = { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent;
  const origin = 'http://127.0.0.1:4417';
  expect(trustedUpdateSender(trusted, contents, origin)).toBe(true);
  for (const change of [{ sender: {} }, { senderFrame: { ...frame } }, { senderFrame: null }])
    expect(
      trustedUpdateSender({ ...trusted, ...change } as IpcMainInvokeEvent, contents, origin),
    ).toBe(false);
  frame.url = 'https://example.com';
  expect(trustedUpdateSender(trusted, contents, origin)).toBe(false);
  frame.url = 'invalid';
  expect(trustedUpdateSender(trusted, contents, origin)).toBe(false);
});
