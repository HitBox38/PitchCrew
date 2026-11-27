import { Button } from '@pitchcrew/design-system/button';
import type { PipelineMode } from '../hooks/usePipelineMode.ts';

const modes: readonly [PipelineMode, string][] = [
  ['board', 'Board'],
  ['table', 'Table'],
];

/**
 * Board | Table, built like Open | Closed beside it (the same 28px clay segment), so the two read as
 * one row of choices. The choice is saved on this device and kept in the URL.
 */
export const PipelineModeSwitch = ({
  mode,
  choose,
}: {
  mode: PipelineMode;
  choose: (mode: PipelineMode) => void;
}) => (
  <fieldset className="view-switch board-segment" aria-label="Pipeline layout">
    {modes.map(([id, label]) => (
      <Button
        key={id}
        variant="ghost"
        aria-pressed={mode === id}
        className={mode === id ? 'active' : ''}
        onClick={() => choose(id)}
      >
        {label}
      </Button>
    ))}
  </fieldset>
);
