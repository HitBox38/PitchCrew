import type { BrowserProfilesCommand, BrowserProfilesState } from './browser-profiles.ts';
import { z } from 'zod';
import type { BrowserFrame } from './computer.ts';

export const nativeBrowserCommandSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.enum([
        'back',
        'forward',
        'reload',
        'hard-reload',
        'stop',
        'clear-cache',
        'new-tab',
        'devtools',
        'open-external',
      ]),
    })
    .strict(),
  z.object({ kind: z.literal('zoom'), factor: z.number().min(0.25).max(5) }).strict(),
  z
    .object({
      kind: z.literal('mute'),
      muted: z.boolean(),
      tabId: z.string().min(1).max(100).optional(),
    })
    .strict(),
  z
    .object({ kind: z.literal('appearance'), colorScheme: z.enum(['system', 'light', 'dark']) })
    .strict(),
  z
    .object({ kind: z.enum(['select-tab', 'close-tab']), tabId: z.string().min(1).max(100) })
    .strict(),
]);
export type NativeBrowserCommand = z.infer<typeof nativeBrowserCommandSchema>;
export interface NativeBrowserIdentity {
  id: string;
  ownerId: string;
}
export interface NativeBrowserState extends NativeBrowserIdentity {
  profile?: { id: string; name: string; workspaceKey?: string };
  dialog?: BrowserFrame['dialog'];
  warning?: string;
  activeTab: string;
  tabs: {
    id: string;
    logicalId?: string;
    title: string;
    url: string;
    loading: boolean;
    zoomFactor?: number;
    favicon?: string;
    audible?: boolean;
    muted?: boolean;
    colorScheme?: 'system' | 'light' | 'dark';
    floating?: boolean;
    error?: string;
    crashed?: boolean;
    window?: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
  }[];
}
export interface NativeBrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface DesktopBrowserView {
  token: string;
  partition: string;
  contentsId?: number;
  bounds: NativeBrowserBounds | null;
  viewport?: { width: number; height: number };
  painting: boolean;
  manual: boolean;
}
export interface DesktopBrowserBridge {
  capture(id: string): Promise<DesktopBrowserCapture>;
  saveArtifact(kind: 'png' | 'webm', data: string): Promise<string | null>;
  copyCapture(data: string): Promise<void>;
  revealArtifact(path: string): Promise<void>;
  floating(id: string, open: boolean): Promise<void>;
  identify(): Promise<string>;
  views(): Promise<DesktopBrowserView[]>;
  registerView(token: string, contentsId: number): Promise<void>;
  subscribeViews(receive: (views: DesktopBrowserView[]) => void): () => void;
  subscribeState(receive: (state: NativeBrowserState) => void): () => void;
  profiles(id: string, command: BrowserProfilesCommand): Promise<BrowserProfilesState>;
  focusPage(id: string): Promise<void>;
  focusControls(id: string, focused: boolean): Promise<void>;
  mount(id: string, bounds: NativeBrowserBounds | null): Promise<void>;
  find(id: string, text: string, forward: boolean): Promise<void>;
  subscribeShortcuts(
    receive: (shortcut: { id: string; key: string; shift: boolean }) => void,
  ): () => void;
}
export interface DesktopBrowserCapture {
  data: string;
  width: number;
  height: number;
  url: string;
  title: string;
}
export const desktopBrowserHostSchema = z
  .object({
    ownerId: z.uuid(),
    origin: z.url().refine((value) => {
      const url = new URL(value);
      return url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.origin === value;
    }),
    token: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type DesktopBrowserHost = z.infer<typeof desktopBrowserHostSchema>;
