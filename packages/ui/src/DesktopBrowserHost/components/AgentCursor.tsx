import type { DesktopBrowserView } from '../../../../core/src/native-browser.ts';
import { browserPagePoint } from '../presentation.ts';
import { useBrowserPresence } from '../presence.ts';

/**
 * Where the agent is acting on a page it drives: a plum pointer with the agent's name that glides
 * between moves and pings on a press. It rests visible while the run lasts and fades after it
 * ends. Hidden during private control.
 */
export const AgentCursor = ({ view }: { view: DesktopBrowserView }) => {
  const presence = useBrowserPresence();
  const pointer = view.agentPointer;
  if (!pointer || view.manual) return null;
  const point = browserPagePoint(view, pointer);
  if (!point) return null;
  return (
    <div
      className="agent-browser-cursor"
      data-browser-cursor={view.token}
      data-working={presence.working || undefined}
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
