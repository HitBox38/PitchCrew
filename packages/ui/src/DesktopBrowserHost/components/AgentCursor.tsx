import type { DesktopBrowserView } from '../../../../core/src/native-browser.ts';
import { browserPagePoint } from '../presentation.ts';

/**
 * Where the agent is acting on a page it drives: a glazed pointer that glides between its
 * moves, pings on a press and rests faintly while idle. Hidden during private control.
 */
export const AgentCursor = ({ view }: { view: DesktopBrowserView }) => {
  const pointer = view.agentPointer;
  if (!pointer || view.manual) return null;
  const point = browserPagePoint(view, pointer);
  if (!point) return null;
  return (
    <div
      className="agent-browser-cursor"
      data-browser-cursor={view.token}
      aria-hidden="true"
      style={{ transform: `translate3d(${point.x}px, ${point.y}px, 0)` }}
    >
      {/* Re-keyed per move so the idle fade and press ping restart. */}
      <span key={pointer.sequence} className="agent-browser-cursor-body">
        {pointer.pressed ? <span className="agent-browser-cursor-ping" /> : null}
        <svg viewBox="0 0 20 20" width="20" height="20" focusable="false">
          <path d="M3.5 2.5 16 9.2l-5.6 1.6-2.3 5.6Z" />
        </svg>
      </span>
    </div>
  );
};
