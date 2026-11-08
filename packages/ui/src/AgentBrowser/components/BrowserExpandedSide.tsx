import type { ReactNode } from 'react';
import type { AgentBrowserProps } from '../types.ts';
import { BrowserRunActivity } from './BrowserRunActivity.tsx';
import { BrowserReply } from './BrowserReply.tsx';
import { shownBrowserRun } from '../layout.ts';

/** Clay expanded browser: the right column with live activity, a message box sharing the
 * conversation's draft and the approval tray. The page column never shares height with the tray,
 * so requests appearing here cannot resize the inspected page. Before the agent's first run here
 * the column narrows to the message box and tray, giving the page that width. */
export const BrowserExpandedSide = ({
  approvals,
  ...props
}: AgentBrowserProps & {
  approvals: ReactNode;
}) => (
  <aside
    className="browser-expanded-side"
    aria-label="Browser activity and approvals"
    data-empty={
      shownBrowserRun(
        props.data.runs,
        props.browserPanel.role!.id,
        props.thread,
        props.browserPanel.session?.runId,
      )
        ? undefined
        : ''
    }
  >
    <div className="browser-expanded-activity">
      <BrowserRunActivity {...props} />
      <BrowserReply {...props} name={props.browserPanel.role!.name} />
    </div>
    {approvals}
  </aside>
);
