import type { ReactNode } from 'react';
import type { ComputerApproval } from '@pitchcrew/core';
import { BrowserApprovalContent } from '@/ComputerApprovals/components/BrowserApprovalContent.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@pitchcrew/design-system/popover';
import type { AgentBrowserProps } from '../types.ts';

/**
 * The exact action and page evidence behind a browser request, opened from the request's own two
 * lines. The tray keeps a fixed small height, so the evidence opens over the page instead of
 * growing the tray; the decision is available here too.
 */
export const BrowserApprovalEvidence = ({
  approval,
  action,
  working,
  summary,
  children,
}: Pick<AgentBrowserProps, 'action' | 'working'> & {
  approval: ComputerApproval;
  summary: string;
  children: ReactNode;
}) => (
  <Popover>
    <PopoverTrigger
      render={
        <button
          type="button"
          className="browser-evidence-trigger"
          aria-label={`Details: ${summary}`}
          title="Review the exact action and page evidence"
        />
      }
    >
      {children}
    </PopoverTrigger>
    <PopoverContent className="browser-evidence-popover max-h-[min(70dvh,36rem)] w-[min(32rem,90vw)] overflow-y-auto p-4 text-sm">
      <BrowserApprovalContent approval={approval} action={action} working={working} />
    </PopoverContent>
  </Popover>
);
