import type { DesktopBrowserView } from '../../../../core/src/native-browser.ts';
import { browserPagePoint } from '../presentation.ts';
import { useBrowserPresence } from '../presence.ts';

/**
 * Where the agent is acting on a page it drives: a plum pointer with the agent's name that glides
 * between moves and pings on a press. It rests faintly during the run, fades soon after the page
 * navigates or the run ends, and hides during private control. Its name stays inside the page.
 */
export const AgentCursor = ({ view }: { view: DesktopBrowserView }) => {
  const presence = useBrowserPresence();
  const pointer = view.agentPointer;
  if (!pointer || view.manual || !view.bounds) return null;
  const point = browserPagePoint(view, pointer);
  if (!point) return null;
  const right = view.bounds.x + view.bounds.width - point.x < 96;
  const bottom = view.bounds.y + view.bounds.height - point.y < 40;
  return (
    <div
      className="agent-browser-cursor"
      data-browser-cursor={view.token}
      data-working={presence.working || undefined}
      data-navigated={pointer.navigated || undefined}
      data-flip-x={right || undefined}
      data-flip-y={bottom || undefined}
      aria-hidden="true"
      style={{ transform: `translate3d(${point.x}px, ${point.y}px, 0)` }}
    >
      {/* Re-keyed per move so the press ping and resting restart. */}
      <span key={pointer.sequence} className="agent-browser-cursor-body">
        {pointer.pressed ? <span className="agent-browser-cursor-ping" /> : null}
        <svg viewBox="0 0 22 22" width="22" height="22" focusable="false">
          <path d="M3.8 2.8 17.6 10.1l-6.2 1.8-2.5 6.2Z" />
        </svg>
        {presence.name ? <span className="agent-browser-cursor-name">{presence.name}</span> : null}
      </span>
    </div>
  );
};
