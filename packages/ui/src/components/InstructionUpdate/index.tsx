import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { DismissedUpdate } from './components/DismissedUpdate.tsx';
import { UpdateActions } from './components/UpdateActions.tsx';
import { UpdateComparison } from './components/UpdateComparison.tsx';
import { UpdateHistory } from './components/UpdateHistory.tsx';
import { UpdateSummary } from './components/UpdateSummary.tsx';
import { useInstructionUpdate } from './hooks/useInstructionUpdate.ts';
import type { InstructionUpdateModel, InstructionUpdateProps } from './types.ts';

/** Shows a newer default for a seeded role. Nothing changes until the user chooses an action. */
export const InstructionUpdate = (props: InstructionUpdateProps) => {
  const model = useInstructionUpdate(props);
  return <InstructionUpdateView {...model} inlineActions />;
};

/**
 * Summary and diff first, release history on request. Actions sit inline, or in the agent panel's
 * pinned footer while the comparison leads it.
 */
export const InstructionUpdateView = ({
  inlineActions,
  ...model
}: InstructionUpdateModel & { inlineActions: boolean }) => {
  if (!model.expanded) return <DismissedUpdate {...model} />;
  return (
    <section
      className="instruction-update"
      aria-labelledby={`${model.role.id}-instruction-update-heading`}
    >
      <UpdateSummary {...model} />
      <UpdateComparison {...model} />
      <UpdateHistory {...model} />
      {model.previous !== null ? (
        <div className="instruction-update-previous">
          <h4>Your previous instructions</h4>
          <p className="optional">
            The editor now holds the new default. Copy what you want to keep, then save settings.
          </p>
          <SourceBlock
            label="Previous instructions"
            value={model.previous}
            contentClassName="font-sans"
          />
        </div>
      ) : null}
      {inlineActions ? <UpdateActions {...model} /> : null}
    </section>
  );
};
