export type { DesktopBrowserView } from '../../../core/src/native-browser.ts';

export const domBrowserChannels = {
  views: 'pitchcrew:browser:views',
  register: 'pitchcrew:browser:register-view',
  changed: 'pitchcrew:browser:views-changed',
} as const;

export const domBrowserBootstrapUrl = (token: string) => `about:blank#pitchcrew-${token}`;
export const nativeBrowserPageUrl = (url: string) =>
  /^about:blank#pitchcrew-[a-f0-9-]{36}$/i.test(url) ? 'about:blank' : url;
