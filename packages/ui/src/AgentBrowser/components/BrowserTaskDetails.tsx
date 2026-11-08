import { Popover, PopoverContent, PopoverTitle } from '@pitchcrew/design-system/popover';
import type { browserState } from '../layout.ts';
import { BrowserTaskTrigger } from './BrowserTaskTrigger.tsx';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { BrowserTask } from './BrowserTask.tsx';
import { BrowserSites } from './BrowserSites.tsx';
export const BrowserTaskDetails = (
  props: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'thread' | 'onThread' | 'onOpenCard'> & {
    control: BrowserControl;
    state: ReturnType<typeof browserState>;
    nudged: boolean;
  },
) => {
  const session = props.browserPanel.session;
  return (
    <Popover>
      {/* The slot keeps the width steady across states; the chip itself hugs its label. */}
      <span className="browser-state-slot" data-reserve={session?.runId ? '' : undefined}>
        <BrowserTaskTrigger state={props.state} nudged={props.nudged} />
      </span>
      <PopoverContent className="browser-task-details w-72 max-w-[calc(100vw-24px)] p-3 font-sans text-sm leading-5">
        <div className="flex items-start justify-between gap-3">
          <PopoverTitle className="m-0 min-w-0 font-sans text-sm leading-5 font-semibold break-words">
            {props.browserPanel.role!.name}’s browser
          </PopoverTitle>
          <span className="shrink-0 text-xs text-muted-foreground">{props.state.label}</span>
        </div>
        <p className="m-0 mt-2 text-xs text-muted-foreground">{props.state.detail}</p>
        {session ? (
          <BrowserTask {...props} />
        ) : (
          <p className="m-0 mt-3 text-xs text-muted-foreground">Open a browser to start.</p>
        )}
        <BrowserSites {...props} />
      </PopoverContent>
    </Popover>
  );
};
