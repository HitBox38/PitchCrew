import { Separator } from '@/components/ui/separator/index.tsx';
import type { AgentBrowserProps } from '../types.ts';
export const BrowserResizer = ({ browserPanel }: Pick<AgentBrowserProps, 'browserPanel'>) => {
  return (
    <Separator
      orientation="vertical"
      render={<button type="button" aria-label="Resize browser panel" />}
      tabIndex={0}
      aria-orientation="vertical"
      aria-label="Resize browser panel"
      aria-valuemin={360}
      aria-valuemax={1000}
      aria-valuenow={Math.round(browserPanel.width)}
      className="browser-resizer"
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          browserPanel.resize(
            Math.max(
              360,
              Math.min(1000, browserPanel.width + (event.key === 'ArrowLeft' ? 32 : -32)),
            ),
          );
        }
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const bounds = event.currentTarget.parentElement!.parentElement!.getBoundingClientRect();
        browserPanel.resize(
          Math.max(360, Math.min(1000, bounds.width - 340, bounds.right - event.clientX)),
        );
      }}
      onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
    />
  );
};
