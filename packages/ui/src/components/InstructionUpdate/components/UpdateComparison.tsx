import { useState } from 'react';
import type { InstructionUpdateModel } from '../types.ts';
import { InstructionDiff } from './InstructionDiff.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';

const views = [
  ['changes', 'Changes'],
  ['current', 'Current'],
  ['proposed', 'New default'],
] as const;

/** Compare: the paragraph diff, or either full text as a reading pane. */
export const UpdateComparison = ({
  role,
  update,
  mode,
  setMode,
  lines,
  counts,
}: InstructionUpdateModel) => {
  const [view, setView] = useState<(typeof views)[number][0]>('changes');
  return (
    <div className="instruction-compare">
      <fieldset
        className="view-switch instruction-compare-switch"
        aria-label="Compare instructions"
      >
        {views.map(([value, label]) => (
          <Button
            key={value}
            variant="ghost"
            aria-pressed={view === value}
            className={view === value ? 'active' : ''}
            onClick={() => setView(value)}
          >
            {label}
          </Button>
        ))}
      </fieldset>
      {view === 'changes' ? (
        <>
          <p className="optional">
            {mode === 'yours' ? 'Your saved instructions' : 'The default you started from'} against
            the new default: {counts.removed} removed and {counts.added} added paragraphs.
            {update.base ? (
              <>
                {' '}
                <Button
                  className="text-button"
                  onClick={() => setMode(mode === 'yours' ? 'default' : 'yours')}
                >
                  {mode === 'yours'
                    ? 'Show only default changes since your version'
                    : 'Compare with your text'}
                </Button>
              </>
            ) : null}
          </p>
          <InstructionDiff lines={lines} />
        </>
      ) : (
        <SourceBlock
          label={
            view === 'current' ? `${role.name}’s current instructions` : 'New default instructions'
          }
          value={view === 'current' ? role.instructions : update.instructions}
          contentClassName="font-sans"
        />
      )}
    </div>
  );
};
