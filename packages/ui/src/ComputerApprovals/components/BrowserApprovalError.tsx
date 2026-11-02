import { AccordionSection } from '@pitchcrew/design-system/accordion';
import type { ComputerApproval } from '@pitchcrew/core';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { browserApprovalError } from '../error.ts';

/** Shared by Decisions history, approval cards and the browser's request tray. */
export const BrowserApprovalError = ({ approval }: { approval: ComputerApproval }) => {
  const error = browserApprovalError(approval);
  if (!error) return null;
  return (
    <div className="browser-approval-error">
      <p role="alert" className="form-error">
        {error.summary}
      </p>
      <AccordionSection heading="Details">
        <SourceBlock label="Browser execution diagnostics" value={error.diagnostics} />
      </AccordionSection>
    </div>
  );
};
