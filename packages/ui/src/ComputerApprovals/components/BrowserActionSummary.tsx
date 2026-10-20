import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import type { BrowserAction } from '@pitchcrew/core';
import { actionFields } from '../helpers.ts';

export const BrowserActionSummary = ({ action }: { action: BrowserAction }) => {
  return (
    <>
      <dl className="browser-action-summary">
        {actionFields(action).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value === '' ? <em>Empty text</em> : value}</dd>
          </div>
        ))}
      </dl>
      <AccordionSection className="approval-preview" heading="Exact action details">
        <SourceBlock label="Action JSON" value={JSON.stringify(action, null, 2)} />
      </AccordionSection>
    </>
  );
};
