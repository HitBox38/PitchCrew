import { ArrowDown, ArrowUp } from 'lucide-react';
import type { DesktopBrowserView } from '../../../../core/src/native-browser.ts';
import { browserPageRect, targetEdge } from '../presentation.ts';
import { useBrowserPresence } from '../presence.ts';

/**
 * A still, dashed ochre ring around the element a waiting request would act on, so the user can
 * see the target on the live page before approving. Ochre follows the bead law: it waits on the
 * user. When the element is mostly out of view, a pill at that edge of the page points to it.
 * Ring and pill are clipped to the page itself; when the page is held at its inspected size inside
 * a larger area, a hairline frame and caption say why. Never drawn during private control.
 */
export const ApprovalTargetRing = ({ view }: { view: DesktopBrowserView }) => {
  const { target, name } = useBrowserPresence();
  const frame = view.bounds;
  if (!target || !frame || view.manual) return null;
  const rect = browserPageRect(view, target);
  const size = view.viewport ?? { width: frame.width, height: frame.height };
  const page = browserPageRect(view, { x: 0, y: 0, ...size });
  if (!rect || !page) return null;
  const held = page.width < frame.width - 8 || page.height < frame.height - 8;
  const edge = targetEdge(page, rect);
  return (
    <>
      {held ? (
        <div
          className="browser-held-page"
          aria-hidden="true"
          style={{ left: page.x, top: page.y, width: page.width, height: page.height }}
        >
          <span
            className="browser-held-caption"
            data-inside={page.y + page.height + 24 > frame.y + frame.height || undefined}
          >
            Kept at the size {name || 'the agent'} inspected until you decide
          </span>
        </div>
      ) : null}
      <div
        className="agent-browser-cursor-frame"
        aria-hidden="true"
        style={{ left: page.x, top: page.y, width: page.width, height: page.height }}
      >
        <div
          className="browser-approval-target"
          style={{
            left: rect.x - page.x - 4,
            top: rect.y - page.y - 4,
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
    </>
  );
};
