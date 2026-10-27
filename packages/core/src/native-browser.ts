import { z } from 'zod';
import type { BrowserFrame } from './computer.ts';

export const nativeBrowserCommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(['back', 'forward', 'reload', 'new-tab']) }).strict(),
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
  dialog?: BrowserFrame['dialog'];
  warning?: string;
  activeTab: string;
  tabs: {
    id: string;
    title: string;
    url: string;
    loading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
  }[];
}
export interface DesktopBrowserBridge {
  identify(): Promise<string>;
  focusPage(id: string): Promise<void>;
  focusControls(id: string, focused: boolean): Promise<void>;
  mount(
    id: string,
    bounds: { x: number; y: number; width: number; height: number } | null,
  ): Promise<void>;
  find(id: string, text: string, forward: boolean): Promise<void>;
  subscribeShortcuts(
    receive: (shortcut: { id: string; key: string; shift: boolean }) => void,
  ): () => void;
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
