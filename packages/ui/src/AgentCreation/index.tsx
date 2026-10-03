import { Sheet } from '@/components/ui/sheet/components/Sheet.tsx';
import { SheetContent } from '@/components/ui/sheet/components/SheetContent.tsx';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { CreationHeading } from './components/CreationHeading.tsx';
import { CreationBody } from './components/CreationBody.tsx';
import { CreationFooter } from './components/CreationFooter.tsx';
import { CreationSuccess } from './components/CreationSuccess.tsx';
import { useAgentCreation } from './hooks/useAgentCreation.ts';
import type { AgentCreationProps } from './types.ts';

export function AgentCreation(props: AgentCreationProps) {
  const controller = useAgentCreation(props);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) controller.close();
      }}
    >
      <SheetContent className="role-settings-panel creation-panel" showCloseButton={false}>
        <CreationHeading {...controller} />
        {controller.created ? (
          <CreationSuccess
            role={controller.created}
            scheduled={controller.draft.scheduled}
            close={controller.close}
          />
        ) : (
          <form
            className="form role-settings-form creation-form flex flex-col"
            onSubmit={(event) => void controller.submit(event)}
          >
            <CreationBody {...controller} />
            <CreationFooter {...controller} />
          </form>
        )}
      </SheetContent>
      <DiscardChanges guard={controller.guard} />
    </Sheet>
  );
}
