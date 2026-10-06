import { DismissedUpdate } from './components/DismissedUpdate.tsx';
import { UpdateActions } from './components/UpdateActions.tsx';
import { UpdateComparison } from './components/UpdateComparison.tsx';
import { UpdateSummary } from './components/UpdateSummary.tsx';
import { useInstructionUpdate } from './hooks/useInstructionUpdate.ts';
import type { InstructionUpdateProps } from './types.ts';

/** Shows a newer default for a seeded role. Nothing changes until the user chooses an action. */
export function InstructionUpdate(props: InstructionUpdateProps) {
  const model = useInstructionUpdate(props);
  if (!model.expanded) return <DismissedUpdate {...model} />;
  return (
    <section
      className="instruction-update flex flex-col gap-3"
      aria-labelledby={`${props.role.id}-instruction-update-heading`}
    >
      <UpdateSummary {...model} />
      <UpdateComparison {...model} />
      {model.previous !== null ? (
        <div className="flex flex-col gap-2">
          <h4 className="instruction-update-label">Your previous instructions</h4>
          <p className="quiet">
            The editor now holds the new default. Copy what you want to keep from here, then save
            settings.
          </p>
          <pre className="instruction-update-previous">{model.previous}</pre>
        </div>
      ) : null}
      <UpdateActions {...model} />
    </section>
  );
}
