import type { CSSProperties, ReactNode } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet/index.tsx';
import { useBrowserViewport } from '../hooks/useBrowserViewport.ts';
import { useDesktopBrowserHost } from '@/DesktopBrowserHost/context.ts';
import { BrowserSheet } from '@/DesktopBrowserHost/BrowserSheet.tsx';

export const BrowserSurface = ({
  modal,
  open,
  name,
  hide,
  children,
}: {
  modal: boolean;
  open: boolean;
  name: string;
  hide: () => void;
  children: ReactNode;
}) => {
  const height = useBrowserViewport();
  const desktop = useDesktopBrowserHost();
  if (!modal) {
    if (!open) return null;
    return (
      <aside
        id="agent-browser-panel"
        className="agent-browser-panel"
        aria-label={`${name} browser`}
      >
        {children}
      </aside>
    );
  }
  if (desktop)
    return (
      <BrowserSheet open={open} name={name} hide={hide}>
        {children}
      </BrowserSheet>
    );
  return (
    <Sheet
      open={open}
      onOpenChange={(open) => {
        if (!open) hide();
      }}
    >
      <SheetContent
        id="agent-browser-panel"
        className="agent-browser-panel browser-sheet"
        style={
          {
            '--browser-viewport-height': `${height}px`,
            height: `calc(${height}px - var(--desktop-titlebar-height, 0px))`,
          } as CSSProperties
        }
        showCloseButton={false}
        initialFocus={() =>
          document.querySelector<HTMLButtonElement>(
            '#agent-browser-panel [data-browser-controls] button',
          )
        }
        finalFocus={() =>
          document.querySelector<HTMLButtonElement>('button[aria-controls="agent-browser-panel"]')
        }
      >
        <SheetTitle className="sr-only">{name}’s browser</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
};
