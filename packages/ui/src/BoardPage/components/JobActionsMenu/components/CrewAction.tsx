import type { CrewShortcut } from '../types.ts';
import { menuComponents } from '@/components/ui/context-menu/menu-components.ts';
import { Play, Square } from 'lucide-react';
import { useId } from 'react';

export const CrewAction = ({
  shortcut,
  disabled,
  context = false,
  perform,
}: {
  shortcut: CrewShortcut;
  disabled: boolean;
  context?: boolean;
  perform: () => void;
}) => {
  const hintId = useId();
  const Menu = menuComponents(context);
  return (
    <Menu.Group>
      <Menu.Item
        disabled={disabled || !!shortcut.reason}
        onClick={perform}
        aria-describedby={shortcut.reason ? hintId : undefined}
      >
        {shortcut.runId ? <Square size={15} /> : <Play size={15} />}
        {shortcut.label}
      </Menu.Item>
      {shortcut.reason ? (
        <p id={hintId} className="max-w-56 px-2 py-1 text-xs text-muted-foreground">
          {shortcut.reason}
        </p>
      ) : null}
    </Menu.Group>
  );
};
