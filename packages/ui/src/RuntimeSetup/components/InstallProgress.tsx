import { LoaderCircle } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { AccordionSection } from '@pitchcrew/design-system/accordion';
import type { RuntimeSetupOperation } from '@pitchcrew/core';
import type { RuntimeSetupRequest } from '../types.ts';
export const InstallProgress = ({
  operation,
  request,
  working,
}: {
  operation: RuntimeSetupOperation;
  request: RuntimeSetupRequest;
  working: boolean;
}) => (
  <section
    className="runtime-setup-operation"
    data-failed={['failed', 'interrupted'].includes(operation.stage) || undefined}
    aria-label="Installation progress"
    aria-busy={!operation.finishedAt}
  >
    <output aria-live="polite" className="inline-flex items-center gap-2">
      {!operation.finishedAt ? (
        <LoaderCircle
          aria-hidden="true"
          size={16}
          className="animate-spin motion-reduce:animate-none"
        />
      ) : null}
      {operation.detail}
    </output>
    {!operation.finishedAt ? (
      <Button
        variant="outline"
        size="sm"
        disabled={working}
        onClick={() => void request('/install/cancel', { operationId: operation.id })}
      >
        Cancel installation
      </Button>
    ) : null}
    {operation.output ? (
      <AccordionSection heading="Installer output">
        <pre className="runtime-installer-output">{operation.output}</pre>
      </AccordionSection>
    ) : null}
  </section>
);
