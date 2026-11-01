import { Popover, PopoverContent, PopoverTitle } from '@pitchcrew/design-system/popover';
import { browserModeChip } from '../layout.ts';
import { BrowserTaskTrigger } from './BrowserTaskTrigger.tsx';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { BrowserTask } from './BrowserTask.tsx';
import { BrowserSites } from './BrowserSites.tsx';
export const BrowserTaskDetails = (
  props: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'thread' | 'onThread' | 'onOpenCard'> & {
    control: BrowserControl;
  },
) => {
  const session = props.browserPanel.session;
  const elsewhere = !!session?.threadId && session.threadId !== props.thread;
  const chip = browserModeChip(session, !!props.control.leaseId);
  return (
    <Popover>
      <BrowserTaskTrigger chip={chip} elsewhere={elsewhere} />
      <PopoverContent className="browser-task-details w-72 max-w-[calc(100vw-24px)] p-3 font-sans text-sm leading-5">
        <div className="flex items-start justify-between gap-3">
          <PopoverTitle className="m-0 min-w-0 font-sans text-sm leading-5 font-semibold break-words">
            {props.browserPanel.role!.name}’s browser
          </PopoverTitle>
          <span className="shrink-0 text-xs text-muted-foreground">
            {props.control.leaseId || session?.manual
              ? 'Agent paused'
              : session?.runId
                ? 'Running'
                : session?.status === 'open'
                  ? 'Ready'
                  : 'Closed'}
          </span>
        </div>
        {session ? (
          <BrowserTask {...props} />
        ) : (
          <p className="m-0 mt-3 text-xs text-muted-foreground">Open a browser to start.</p>
        )}
        {session && !session.runId ? (
          <p className="m-0 mt-3 text-xs text-muted-foreground">No active agent turn.</p>
        ) : null}
        <BrowserSites {...props} />
      </PopoverContent>
    </Popover>
  );
};
