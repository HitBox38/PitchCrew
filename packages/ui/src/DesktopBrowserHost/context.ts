import { createContext, useContext, type ReactNode } from 'react';

export interface BrowserSurfaceState {
  owner: symbol;
  name: string;
  children: ReactNode;
  hide(): void;
}

export interface DesktopBrowserContextValue {
  show(surface: BrowserSurfaceState): void;
  clear(owner: symbol): void;
}

export const DesktopBrowserContext = createContext<DesktopBrowserContextValue | null>(null);
export const useDesktopBrowserHost = () => useContext(DesktopBrowserContext);
