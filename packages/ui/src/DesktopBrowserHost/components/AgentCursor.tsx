import type { DesktopBrowserView } from '../../../../core/src/native-browser.ts';
import { browserPagePoint } from '../presentation.ts';
import { useBrowserPresence } from '../presence.ts';
import { useAgentCursorPhase } from '../hooks/useAgentCursorPhase.ts';

/**
 * Where the agent is acting on a page it drives: a plum pointer with the agent's name that glides
 * between moves and pings on a press. It rests faintly during the run, fades soon after the page
 * navigates or the run ends, and hides during private control. Its name stays inside the page.
 */
export const AgentCursor = ({ view }: { view: DesktopBrowserView }) => {
  const presence = useBrowserPresence();
  const pointer = view.agentPointer;
  const phase = useAgentCursorPhase(pointer?.sequence, !!pointer?.navigated, presence.working);
  const frame = view.bounds;
  if (!pointer || phase === 'hidden' || view.manual || !frame) return null;
  const point = browserPagePoint(view, pointer);
  if (!point) return null;
  const x = point.x - frame.x;
  const y = point.y - frame.y;
  return (
    // The frame clips the pointer and its name to the page, never drawing over the app.
    <div
      className="agent-browser-cursor-frame"
      aria-hidden="true"
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
    >
      <div
        className="agent-browser-cursor"
        data-browser-cursor={view.token}
        data-phase={phase}
        data-flip-x={frame.width - x < 96 || undefined}
        data-flip-y={frame.height - y < 40 || undefined}
        style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
      >
        {/* Re-keyed per move so the press ping restarts. */}
        <span key={pointer.sequence} className="agent-browser-cursor-body">
          {pointer.pressed ? <span className="agent-browser-cursor-ping" /> : null}
          <svg viewBox="0 0 22 22" width="22" height="22" focusable="false">
            <path d="M3.8 2.8 17.6 10.1l-6.2 1.8-2.5 6.2Z" />
          </svg>
          {presence.name ? (
            <span className="agent-browser-cursor-name">{presence.name}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
};
