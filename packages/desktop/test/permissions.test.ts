import type { BrowserWindow, Session, WebContents } from 'electron';
import { expect, test, vi } from 'vitest';
import { installDesktopPermissions } from '../src/permissions.ts';

const origin = 'http://127.0.0.1:4417';
const fixture = () => {
  const session = {
    setPermissionCheckHandler: vi.fn<Session['setPermissionCheckHandler']>(),
    setPermissionRequestHandler: vi.fn<Session['setPermissionRequestHandler']>(),
  };
  const contents = { mainFrame: { url: `${origin}/settings?section=accounts` } } as WebContents;
  let window: BrowserWindow | null = { webContents: contents } as BrowserWindow;
  installDesktopPermissions(
    session as unknown as Session,
    () => window,
    () => origin,
  );
  const check = session.setPermissionCheckHandler.mock.lastCall![0]!;
  const request = session.setPermissionRequestHandler.mock.lastCall![0]!;
  return {
    contents,
    check,
    request,
    close: () => {
      window = null;
    },
  };
};

test('allows clipboard text writes from the current app main frame through both permission paths', () => {
  const { contents, check, request } = fixture();
  const details = { isMainFrame: true, requestingUrl: `${origin}/settings?section=accounts` };
  expect(check(contents, 'clipboard-sanitized-write', origin, details)).toBe(true);
  const callback = vi.fn();
  request(contents, 'clipboard-sanitized-write', callback, details);
  expect(callback).toHaveBeenCalledExactlyOnceWith(true);
});

test.each([
  'clipboard-read',
  'deprecated-sync-clipboard-read',
  'notifications',
  'media',
  'unknown',
] as const)('continues denying %s even for the trusted app', (permission) => {
  const { contents, check, request } = fixture();
  const details = { isMainFrame: true, requestingUrl: origin };
  expect(check(contents, permission, origin, details)).toBe(false);
  const callback = vi.fn();
  request(contents, permission, callback, details);
  expect(callback).toHaveBeenCalledExactlyOnceWith(false);
});

test.each([
  { isMainFrame: false, requestingUrl: origin },
  { isMainFrame: true, requestingUrl: 'https://example.com' },
  { isMainFrame: true, requestingUrl: 'http://127.0.0.1:4418' },
  { isMainFrame: true, requestingUrl: 'invalid' },
  { isMainFrame: true, requestingUrl: '' },
])('denies text writes from untrusted frames: %j', (details) => {
  const { contents, check, request } = fixture();
  expect(check(contents, 'clipboard-sanitized-write', origin, details)).toBe(false);
  const callback = vi.fn();
  request(contents, 'clipboard-sanitized-write', callback, details);
  expect(callback).toHaveBeenCalledExactlyOnceWith(false);
});

test('denies text writes from other windows, workers, closed windows and navigated app windows', () => {
  const f = fixture();
  const details = { isMainFrame: true, requestingUrl: origin };
  expect(f.check(null, 'clipboard-sanitized-write', origin, details)).toBe(false);
  expect(
    f.check({ ...f.contents } as WebContents, 'clipboard-sanitized-write', origin, details),
  ).toBe(false);
  expect(f.check(f.contents, 'clipboard-sanitized-write', origin, { isMainFrame: true })).toBe(
    false,
  );
  Object.assign(f.contents.mainFrame, { url: 'https://example.com' });
  expect(f.check(f.contents, 'clipboard-sanitized-write', origin, details)).toBe(false);
  f.close();
  expect(f.check(f.contents, 'clipboard-sanitized-write', origin, details)).toBe(false);
});
