import { expect, it } from 'vitest';
import type { DesktopUpdateState } from '@pitchcrew/core';
import { desktopUpdateEvent } from '../desktop-updates.ts';

const available: DesktopUpdateState = {
  enabled: true,
  currentVersion: '0.2.0',
  status: 'available',
  availableVersion: '0.3.0',
  downloadedVersion: null,
  downloadPercent: null,
  checkedAt: null,
  message: 'Private message',
};

it('counts accepted download/install transitions once without counting initial state or progress', () => {
  const downloading = { ...available, status: 'downloading' as const, downloadPercent: 0 };
  const downloaded = { ...available, status: 'downloaded' as const, downloadedVersion: '0.3.0' };
  const installing = { ...downloaded, status: 'installing' as const };
  expect(desktopUpdateEvent(null, downloading)).toBeUndefined();
  expect(desktopUpdateEvent(available, downloading)).toBe('app_update_download_requested');
  expect(desktopUpdateEvent(downloading, { ...downloading, downloadPercent: 75 })).toBeUndefined();
  expect(desktopUpdateEvent(downloading, downloaded)).toBeUndefined();
  expect(desktopUpdateEvent(downloaded, downloaded)).toBeUndefined();
  expect(desktopUpdateEvent(downloaded, installing)).toBe('app_update_install_requested');
  expect(desktopUpdateEvent(installing, installing)).toBeUndefined();
  expect(desktopUpdateEvent(available, { ...available, status: 'error' })).toBeUndefined();
});
