import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { DesktopBrowserContext, type BrowserSurfaceState } from './context.ts';
import { BrowserGuest } from './components/BrowserGuest.tsx';
import { BrowserLayer } from './components/BrowserLayer.tsx';
import { useBrowserViews } from './hooks/useBrowserViews.ts';
import { useWindowSize } from './hooks/useWindowSize.ts';
import './styles.css';

export const DesktopBrowserHost = ({ children }: { children: ReactNode }) => {
  const views = useBrowserViews();
  const viewport = useWindowSize();
  const [surface, setSurface] = useState<BrowserSurfaceState | null>(null);
  const show = useCallback(
    (next: BrowserSurfaceState) =>
      setSurface((previous) =>
        previous?.owner === next.owner &&
        previous.name === next.name &&
        previous.children === next.children
          ? previous
          : next,
      ),
    [],
  );
  const clear = useCallback(
    (owner: symbol) => setSurface((previous) => (previous?.owner === owner ? null : previous)),
    [],
  );
  const context = useMemo(() => ({ show, clear }), [show, clear]);
  if (!window.pitchcrewBrowser?.views) return children;
  return (
    <DesktopBrowserContext value={context}>
      {children}
      <BrowserLayer surface={surface}>
        {views.map((view) => (
          <BrowserGuest key={view.token} view={view} viewport={viewport} />
        ))}
      </BrowserLayer>
    </DesktopBrowserContext>
  );
};
