import { expect, it, vi } from 'vitest';
import { parseNotification } from '../src/notification-payload.ts';

const state = vi.hoisted(() => ({ receive: undefined as unknown, created: [] as any[] }));
vi.mock('electron', () => ({
  ipcMain: {
    on: (_channel: string, handler: unknown) => {
      state.receive = handler;
    },
  },
  Notification: class {
    static isSupported() {
      return true;
    }
    handlers = new Map();
    show = vi.fn();
    close = vi.fn();
    constructor(public options: unknown) {
      state.created.push(this);
    }
    on(name: string, handler: unknown) {
      this.handlers.set(name, handler);
    }
  },
}));
import { installNotifications } from '../src/notifications.ts';
const payload = {
  id: 'message:fixture',
  title: 'Scout needs your input',
  body: 'Which location?',
  kind: 'attention',
  target: '/chat/scout',
};
it('rejects arbitrary navigation and oversized native payloads', () => {
  expect(parseNotification(payload)).toEqual(payload);
  for (const invalid of [
    null,
    {},
    { ...payload, target: 'https://example.com' },
    { ...payload, target: '/inbox?approve=yes' },
    { ...payload, body: 'x'.repeat(241) },
    { ...payload, kind: 'urgent' },
  ])
    expect(parseNotification(invalid)).toBeNull();
});
it('accepts only same-origin main-frame IPC, deduplicates and routes clicks without approvals', () => {
  const frame = { url: 'http://127.0.0.1:4417' };
  const window = {
    webContents: { mainFrame: frame, send: vi.fn() },
    isMinimized: () => true,
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
  };
  installNotifications(() => window as any, frame.url, {} as any);
  const receive = state.receive as (...args: any[]) => void;
  receive({ sender: {}, senderFrame: frame }, payload);
  receive({ sender: window.webContents, senderFrame: { url: frame.url } }, payload);
  frame.url = 'https://example.com';
  receive({ sender: window.webContents, senderFrame: frame }, payload);
  expect(state.created).toHaveLength(0);
  frame.url = 'http://127.0.0.1:4417';
  receive({ sender: window.webContents, senderFrame: frame }, payload);
  receive({ sender: window.webContents, senderFrame: frame }, payload);
  expect(state.created).toHaveLength(1);
  expect(state.created[0].options).toMatchObject({ silent: true, urgency: 'critical' });
  state.created[0].handlers.get('click')();
  expect(window.restore).toHaveBeenCalled();
  expect(window.webContents.send).toHaveBeenCalledWith(
    'pitchcrew:notification-open',
    payload.id,
    payload.target,
  );
});
