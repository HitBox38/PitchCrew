import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { isFinalSubmission } from '@/ComputerApprovals/helpers.ts';
import { BrowserApprovalDetails } from '@/components/InboxView/components/BrowserApprovalDetails.tsx';
import { BrowserDecisionFooter } from '@/components/InboxView/components/BrowserDecisionFooter.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { deskScope } from '../../../constants.ts';
import { useDeskTools } from '../../../hooks/useDeskTools.ts';
import type { BodyProps } from '../../../types.ts';
import { CapturedPage } from './CapturedPage.tsx';
import { OpenHeader } from './OpenHeader.tsx';
import { WaitingOn } from './WaitingOn.tsx';

/**
 * A browser request: the exact action, the page as captured (beside the words on a wide desk, under
 * the action on a narrow one), who asked, what the run holds while it waits, then the existing
 * approval footer with Details among its verbs. Details opens the full evidence in place under it all (the body is the disclosure's
 * root); it starts open when the request uploads something, since the exact upload is part of
 * what is approved. A final submission (a dialog continuing an uncertain one included) never takes
 * the decide shortcut: focus lands on the next row after each decision, so a repeated press could
 * otherwise reach one.
 */
export const BrowserBody = ({ item, data, armedAt }: BodyProps) => {
  const { act } = useDeskTools();
  const working = useWorkspaceStore((state) => state.working);
  const approval = data.computerApprovals.find((entry) => entry.id === item.entityId);
  const uploads = approval?.uploadContent !== undefined || !!approval?.uploadPreview;
  const [details, setDetails] = useState(uploads);
  if (!approval) return null;
  const submission = isFinalSubmission(approval.action);
  return (
    <Collapsible open={details} onOpenChange={setDetails} className="needs-browser">
      <div className="needs-figure">
        <OpenHeader item={item} data={data}>
          <CapturedPage approval={approval} />
        </OpenHeader>
        <WaitingOn item={item} data={data} />
        <div className="needs-decide">
          <BrowserDecisionFooter
            computerApprovals={[approval]}
            action={act({ item, data })}
            working={working}
            shortcut={submission ? undefined : deskScope}
            armedAt={armedAt}
          />
          <CollapsibleTrigger render={<Button variant="ghost" className="needs-review-toggle" />}>
            {details ? 'Hide details' : 'Details'}
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent keepMounted className="needs-review-panel">
        <BrowserApprovalDetails approval={approval} omitScreenshot />
      </CollapsibleContent>
    </Collapsible>
  );
};
