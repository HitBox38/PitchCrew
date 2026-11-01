import type { ComputerApproval } from '@pitchcrew/core';
import { BrowserApprovalContent } from '@/ComputerApprovals/components/BrowserApprovalContent.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { Popover, PopoverContent, PopoverTrigger } from '@pitchcrew/design-system/popover';
import type { AgentBrowserProps } from '../types.ts';

const heading = 'Review exact action and page evidence';

/**
 * The exact action and page evidence behind a browser request. The tray keeps a fixed small
 * height, so the evidence opens over the page instead of growing the tray.
 */
export const BrowserApprovalEvidence = ({
  approval,
  action,
  working,
}: Pick<AgentBrowserProps, 'action' | 'working'> & { approval: ComputerApproval }) => {
  const content = (
    <BrowserApprovalContent
      approval={approval}
      action={action}
      working={working}
      showActions={false}
    />
  );
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="browser-evidence-trigger" title={heading} />
        }
      >
        Details
      </PopoverTrigger>
      <PopoverContent className="browser-evidence-popover max-h-[min(70dvh,36rem)] w-[min(32rem,90vw)] overflow-y-auto p-4 text-sm">
        {content}
      </PopoverContent>
    </Popover>
  );
};
