import { ArrowDown, ArrowUp } from 'lucide-react';
import type { DesktopBrowserView } from '../../../../core/src/native-browser.ts';
import { browserPageRect, targetEdge } from '../presentation.ts';
import { useBrowserPresence } from '../presence.ts';

/**
 * A still, dashed ochre ring around the element a waiting request would act on, so the user can
 * see the target on the live page before approving. Ochre follows the bead law: it waits on the
 * user. When the element is mostly out of view, a pill at that edge of the page points to it.
 * Clipped to the page, never drawn during private control.
 */
export const ApprovalTargetRing = ({ view }: { view: DesktopBrowserView }) => {
  const { target } = useBrowserPresence();
  const frame = view.bounds;
  if (!target || !frame || view.manual) return null;
  const rect = browserPageRect(view, target);
  if (!rect) return null;
  const edge = targetEdge(frame, rect);
  return (
    <div
      className="agent-browser-cursor-frame"
      aria-hidden="true"
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
    >
      <div
        className="browser-approval-target"
        style={{
          left: rect.x - frame.x - 4,
          top: rect.y - frame.y - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
      />
      {edge ? (
        <span className="browser-approval-target-edge" data-edge={edge}>
          {edge === 'below' ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
          Target {edge}
        </span>
      ) : null}
    </div>
  );
};
