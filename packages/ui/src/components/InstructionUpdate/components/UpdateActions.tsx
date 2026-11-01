import type { InstructionUpdateModel } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

/** Use new default, Edit from new default and Keep mine: inline, or as a pinned decision footer. */
export const UpdateActions = ({
  update,
  working,
  confirming,
  unsaved,
  adopt,
  dismiss,
  startFromDefault,
  previous,
  error,
  footer = false,
}: InstructionUpdateModel & { footer?: boolean }) => {
  const notes = (
    <>
      {unsaved ? (
        <p className="optional instruction-update-note">
          Save or undo your instruction edits before you use the new default directly.
        </p>
      ) : null}
      {confirming ? (
        <p role="alert" className="instruction-update-confirm instruction-update-note">
          This replaces your text with the new default. To keep parts of it, choose Edit from new
          default instead.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="form-error instruction-update-note">
          {error}
        </p>
      ) : null}
    </>
  );
  const buttons = (
    <>
      {update.dismissed ? null : (
        <Button className="button small" disabled={working} onClick={() => void dismiss()}>
          Keep mine
        </Button>
      )}
      {previous === null ? (
        <Button className="button small" disabled={working} onClick={startFromDefault}>
          Edit from new default
        </Button>
      ) : null}
      <Button
        className={footer ? 'button small primary' : 'button small'}
        disabled={working || unsaved}
        onClick={() => void adopt()}
      >
        {confirming ? 'Replace my instructions' : 'Use new default'}
      </Button>
    </>
  );
  if (footer)
    return (
      <footer
        className="ui-footer-bar agent-panel-footer instruction-decision-footer"
        aria-label="Decide on the new default instructions"
      >
        {notes}
        {buttons}
      </footer>
    );
  return (
    <>
      {notes}
      <div className="instruction-update-actions">{buttons}</div>
    </>
  );
};
