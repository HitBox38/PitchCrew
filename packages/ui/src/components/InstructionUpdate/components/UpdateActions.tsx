import type { InstructionUpdateModel } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

export function UpdateActions({
  update,
  working,
  ownText,
  confirming,
  unsaved,
  adopt,
  dismiss,
  startFromDefault,
  previous,
  error,
}: InstructionUpdateModel) {
  return (
    <>
      {unsaved ? (
        <p className="quiet">
          Save or undo your instruction edits before you use the new default directly.
        </p>
      ) : null}
      {confirming ? (
        <p role="alert">
          This replaces your text with the new default. To keep parts of it, choose Edit from new
          default instead.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          className="button primary"
          disabled={working || unsaved}
          onClick={() => void adopt()}
        >
          {confirming ? 'Replace my instructions' : 'Use new default'}
        </Button>
        {(ownText || unsaved) && previous === null ? (
          <Button className="button" disabled={working} onClick={startFromDefault}>
            Edit from new default
          </Button>
        ) : null}
        {update.dismissed ? null : (
          <Button className="button" disabled={working} onClick={() => void dismiss()}>
            Keep mine
          </Button>
        )}
      </div>
    </>
  );
}
