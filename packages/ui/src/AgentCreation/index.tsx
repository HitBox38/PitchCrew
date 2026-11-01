import { Dialog, DialogContent } from '@/components/ui/dialog/index.tsx';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { CreationHeading } from './components/CreationHeading.tsx';
import { CreationBody } from './components/CreationBody.tsx';
import { CreationFooter } from './components/CreationFooter.tsx';
import { CreationSuccess } from './components/CreationSuccess.tsx';
import { useAgentCreation } from './hooks/useAgentCreation.ts';
import type { AgentCreationProps } from './types.ts';

/** New agent: a 760px dialog walking Purpose, Runtime, Tools, Skills, Routine and Review. */
export const AgentCreation = (props: AgentCreationProps) => {
  const controller = useAgentCreation(props);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) controller.close();
      }}
    >
      <DialogContent className="agent-wizard" showCloseButton={false}>
        <CreationHeading {...controller} />
        {controller.created ? (
          <CreationSuccess
            role={controller.created}
            scheduled={controller.draft.scheduled}
            close={controller.close}
          />
        ) : (
          <form
            className="form agent-wizard-form"
            onSubmit={(event) => void controller.submit(event)}
          >
            <CreationBody {...controller} />
            <CreationFooter {...controller} />
          </form>
        )}
      </DialogContent>
      <DiscardChanges guard={controller.guard} />
    </Dialog>
  );
};
