import type { InstructionUpdateModel } from '../types.ts';
import { InstructionDiff } from './InstructionDiff.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';

export function UpdateComparison({ update, mode, setMode, lines, counts }: InstructionUpdateModel) {
  return (
    <div className="flex flex-col gap-2">
      {update.base ? (
        <fieldset className="inbox-tabs" aria-label="Comparison">
          <Button
            aria-pressed={mode === 'yours'}
            className={mode === 'yours' ? 'active' : ''}
            onClick={() => setMode('yours')}
          >
            Your text and the new default
          </Button>
          <Button
            aria-pressed={mode === 'default'}
            className={mode === 'default' ? 'active' : ''}
            onClick={() => setMode('default')}
          >
            Default changes since your version
          </Button>
        </fieldset>
      ) : null}
      <p className="quiet">
        {mode === 'yours' ? 'Your saved instructions' : 'The default you started from'} compared
        with the new default: {counts.removed} removed and {counts.added} added paragraphs. Removed
        text is struck through.
      </p>
      <InstructionDiff lines={lines} />
    </div>
  );
}
