import { ipcMain, Notification, type BrowserWindow, type NativeImage } from 'electron';
import { parseNotification } from './notification-payload.ts';

export function installNotifications(
  getWindow: () => BrowserWindow | null,
  origin: string,
  icon: NativeImage,
) {
  const seen = new Set<string>();
  const active = new Set<Notification>();
  ipcMain.on('pitchcrew:notify', (event, value: unknown) => {
    const window = getWindow();
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !event.senderFrame ||
      new URL(event.senderFrame.url).origin !== origin
    )
      return;
    const payload = parseNotification(value);
    if (!payload || seen.has(payload.id) || !Notification.isSupported()) return;
    seen.add(payload.id);
    if (seen.size > 500) seen.delete(seen.values().next().value!);
    const notification = new Notification({
      title: payload.title,
      body: payload.body,
      icon,
      silent: true,
      urgency: payload.kind === 'attention' ? 'critical' : 'normal',
    });
    active.add(notification);
    const release = () => active.delete(notification);
    notification.on('close', release);
    notification.on('failed', release);
    notification.on('click', () => {
      const current = getWindow();
      if (current && new URL(current.webContents.mainFrame.url).origin === origin) {
        if (current.isMinimized()) current.restore();
        current.show();
        current.focus();
        current.webContents.send('pitchcrew:notification-open', payload.id, payload.target);
      }
      release();
    });
    // Keep retained native notifications bounded even when the OS omits close events.
    if (active.size > 50) {
      const oldest = active.values().next().value!;
      oldest.close();
      active.delete(oldest);
    }
    notification.show();
  });
}
