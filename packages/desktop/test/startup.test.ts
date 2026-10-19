import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { installStartupTiming } from '../src/startup.ts';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
afterEach(() => vi.restoreAllMocks());

function fixture() {
  const mainFrame = { url: 'http://127.0.0.1:4417/' };
  const webContents = Object.assign(new EventEmitter(), { mainFrame });
  const window = Object.assign(new EventEmitter(), { webContents });
  installStartupTiming(window as unknown as BrowserWindow, 'http://127.0.0.1:4417', 2000);
  const receive = vi.mocked(ipcMain.handle).mock.lastCall![1];
  const event = { sender: webContents, senderFrame: mainFrame } as unknown as IpcMainInvokeEvent;
  return { window, webContents, event, receive };
}

it('measures from native process start, rejects other senders and subframes, and consumes once', () => {
  vi.spyOn(process, 'uptime').mockReturnValue(5);
  const f = fixture();
  expect(f.receive({ ...f.event, sender: {} } as IpcMainInvokeEvent)).toBeNull();
  expect(
    f.receive({ ...f.event, senderFrame: { url: 'http://127.0.0.1:4417/' } } as IpcMainInvokeEvent),
  ).toBeNull();
  expect(f.receive(f.event)).toEqual({ duration_ms: 5000, daemon_ready_ms: 2000 });
  expect(f.receive(f.event)).toBeNull();
});

it('rejects an unexpected origin without consuming the valid measurement', () => {
  const f = fixture();
  f.webContents.mainFrame.url = 'https://example.com';
  expect(f.receive(f.event)).toBeNull();
  f.webContents.mainFrame.url = 'http://127.0.0.1:4417/';
  expect(f.receive(f.event)).toMatchObject({ daemon_ready_ms: 2000 });
});

it.each(['reload', 'closed'])('does not treat %s as a new process launch', (action) => {
  const f = fixture();
  const navigation = { isMainFrame: true, isSameDocument: false };
  f.webContents.emit('did-start-navigation', navigation);
  if (action === 'reload') f.webContents.emit('did-start-navigation', navigation);
  else f.window.emit('closed');
  expect(f.receive(f.event)).toBeNull();
});
