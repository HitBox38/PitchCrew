import { EventEmitter } from 'node:events';
import { beforeEach, expect, it, vi } from 'vitest';
import { dialog, shell, type BrowserWindow, type WebContents } from 'electron';
import { installExternalNavigation } from '../src/external-navigation.ts';

const origin = 'http://127.0.0.1:4417';
const fixture = () => {
  const webContents = Object.assign(new EventEmitter(), {
    mainFrame: { url: `${origin}/chat/scout` },
    send: vi.fn(),
    setWindowOpenHandler: vi.fn<WebContents['setWindowOpenHandler']>(),
  });
  const window = { webContents, isDestroyed: vi.fn(() => false) };
  installExternalNavigation(window as unknown as BrowserWindow, origin);
  const open = (url: string) =>
    webContents.setWindowOpenHandler.mock.lastCall![0]({ url } as Parameters<
      Parameters<WebContents['setWindowOpenHandler']>[0]
    >[0]);
  return { window, webContents, open };
};

vi.mock('electron', () => ({
  shell: { openExternal: vi.fn(async () => {}) },
  dialog: { showMessageBox: vi.fn(async () => ({ response: 0, checkboxChecked: false })) },
}));
beforeEach(() => vi.clearAllMocks());

it.each([
  'https://boards.greenhouse.io/example/jobs/123',
  'https://jobs.ashbyhq.com/example/123',
  'https://example.com/source?q=role#requirements',
  'https://github.com/example/repo/blob/main/README.md',
  'https://docs.google.com/document/d/fixture/edit',
  'http://example.com/careers',
  'https://cli.github.com/',
  'https://github.com/googleworkspace/cli',
  `https://github.com/HitBox38/PitchCrew/releases/tag/build-${'a'.repeat(40)}`,
  'https://accounts.google.com/o/oauth2/v2/auth?state=fixture',
])('hands %s to the system browser and never creates an Electron popup', (url) => {
  expect(fixture().open(url)).toEqual({ action: 'deny' });
  expect(shell.openExternal).toHaveBeenCalledExactlyOnceWith(url);
});

it('normalizes web URLs before handing them to the operating system', () => {
  fixture().open('HTTPS://EXAMPLE.COM/a path');
  expect(shell.openExternal).toHaveBeenCalledExactlyOnceWith('https://example.com/a%20path');
});

it.each([
  `${origin}/settings`,
  'javascript:alert(1)',
  'file:///etc/passwd',
  'ms-settings:privacy',
  'https://user:password@example.com/',
  'not a URL',
])('does not hand internal, invalid or unsafe URLs to the operating system: %s', (url) => {
  expect(fixture().open(url)).toEqual({ action: 'deny' });
  expect(shell.openExternal).not.toHaveBeenCalled();
});

it.each(['https://example.com/', 'about:blank', 'invalid'])(
  'rejects popup requests after the app window leaves its trusted origin: %s',
  (url) => {
    const f = fixture();
    f.webContents.mainFrame.url = url;
    expect(f.open('https://example.com/source')).toEqual({ action: 'deny' });
    expect(shell.openExternal).not.toHaveBeenCalled();
    expect(f.webContents.send).not.toHaveBeenCalled();
  },
);

it.each([
  ['javascript:alert(1)', 'unsupported-protocol'],
  ['file:///etc/passwd', 'unsupported-protocol'],
  ['ms-settings:privacy', 'unsupported-protocol'],
  ['https://user:password@example.com/private', 'embedded-credentials'],
  ['not a URL', 'invalid-url'],
])('explains why an unsafe popup was blocked: %s', (url, reason) => {
  const f = fixture();
  expect(f.open(url)).toEqual({ action: 'deny' });
  expect(f.webContents.send).toHaveBeenCalledExactlyOnceWith('pitchcrew:link-blocked', reason);
  expect(shell.openExternal).not.toHaveBeenCalled();
});

it('does not report ordinary internal links as unsafe', () => {
  const f = fixture();
  f.open(`${origin}/settings`);
  expect(f.webContents.send).not.toHaveBeenCalled();
});

it('explains blocked unsafe navigation in the current window', () => {
  const f = fixture();
  const event = { preventDefault: vi.fn() };
  f.webContents.emit('will-navigate', event, 'file:///etc/passwd');
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(f.webContents.send).toHaveBeenCalledExactlyOnceWith(
    'pitchcrew:link-blocked',
    'unsupported-protocol',
  );
});

it.each([`${origin}/settings?section=accounts`, `${origin}/chat/scout`, `${origin}/#main`])(
  'keeps internal navigation in the app: %s',
  (url) => {
    const f = fixture();
    const event = { preventDefault: vi.fn() };
    f.webContents.emit('will-navigate', event, url);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(shell.openExternal).not.toHaveBeenCalled();
  },
);

it.each(['https://example.com', 'javascript:alert(1)', 'file:///etc/passwd', 'invalid'])(
  'prevents external navigation inside the app window: %s',
  (url) => {
    const f = fixture();
    const event = { preventDefault: vi.fn() };
    f.webContents.emit('will-navigate', event, url);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(shell.openExternal).not.toHaveBeenCalled();
  },
);

it('reports system-browser launch failures without exposing the URL or native error', async () => {
  vi.mocked(shell.openExternal).mockRejectedValueOnce(new Error('Native error with private data'));
  const f = fixture();
  expect(f.open('https://example.com/private')).toEqual({ action: 'deny' });
  await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalledOnce());
  expect(dialog.showMessageBox).toHaveBeenCalledWith(f.window, {
    type: 'error',
    title: 'Could not open link',
    message: 'Could not open this link in your browser.',
    detail: 'Copy the link and open it in your browser.',
  });
});

it('does not show a failed browser launch dialog after the app window closes', async () => {
  vi.mocked(shell.openExternal).mockRejectedValueOnce(new Error('Native error'));
  const f = fixture();
  f.open('https://example.com/');
  f.window.isDestroyed.mockReturnValue(true);
  await Promise.resolve();
  expect(dialog.showMessageBox).not.toHaveBeenCalled();
});
