import type { CrewShortcut } from '../types.ts';
import { DropdownMenuGroup, DropdownMenuItem } from '@/components/ui/dropdown-menu/index.tsx';
import { Play, Square } from 'lucide-react';
import { useId } from 'react';

export const CrewAction = ({
  shortcut,
  disabled,
  perform,
}: {
  shortcut: CrewShortcut;
  disabled: boolean;
  perform: () => void;
}) => {
  const hintId = useId();
  return (
    <DropdownMenuGroup>
      <DropdownMenuItem
        disabled={disabled || !!shortcut.reason}
        onClick={perform}
        aria-describedby={shortcut.reason ? hintId : undefined}
      >
        {shortcut.runId ? <Square size={15} /> : <Play size={15} />}
        {shortcut.label}
      </DropdownMenuItem>
      {shortcut.reason ? (
        <p id={hintId} className="max-w-56 px-2 py-1 text-xs text-muted-foreground">
          {shortcut.reason}
        </p>
      ) : null}
    </DropdownMenuGroup>
  );
};
