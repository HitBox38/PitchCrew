import type { BrowserWindow, Session, WebContents } from 'electron';

/** Only the app's main frame may write text; clipboard reads and other permissions stay denied. */
export const installDesktopPermissions = (
  session: Session,
  getWindow: () => BrowserWindow | null,
  getOrigin: () => string,
) => {
  const allow = (
    contents: WebContents | null,
    permission: string,
    details: { isMainFrame: boolean; requestingUrl?: string },
  ) => {
    const window = getWindow();
    if (
      permission !== 'clipboard-sanitized-write' ||
      !window ||
      contents !== window.webContents ||
      !details.isMainFrame ||
      !details.requestingUrl
    )
      return false;
    try {
      const origin = getOrigin();
      return (
        new URL(details.requestingUrl).origin === origin &&
        new URL(contents.mainFrame.url).origin === origin
      );
    } catch {
      return false;
    }
  };
  session.setPermissionCheckHandler((contents, permission, _origin, details) =>
    allow(contents, permission, details),
  );
  session.setPermissionRequestHandler((contents, permission, callback, details) =>
    callback(allow(contents, permission, details)),
  );
};
