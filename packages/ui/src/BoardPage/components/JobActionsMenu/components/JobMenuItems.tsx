import { ArrowUpRight, Link, Trash2 } from 'lucide-react';
import { MoveToMenu } from './MoveToMenu.tsx';
import { CrewAction } from './CrewAction.tsx';
import { quickStatuses, shortcutLabels } from '../helpers.ts';
import { menuComponents } from '@/components/ui/context-menu/menu-components.ts';
import type { JobActionsMenuProps } from '../types.ts';
import type { useJobActionsMenu } from '../hooks/useJobActionsMenu.ts';

export const JobMenuItems = ({
  card,
  disabled,
  model,
  context = false,
}: Pick<JobActionsMenuProps, 'card' | 'disabled'> & {
  model: ReturnType<typeof useJobActionsMenu>;
  context?: boolean;
}) => {
  const Menu = menuComponents(context);
  return (
    <>
      <Menu.Group>
        <Menu.Item onClick={model.openDetails}>
          <ArrowUpRight size={15} />
          Open details
        </Menu.Item>
        <MoveToMenu
          card={card}
          context={context}
          disabled={!model.mutable}
          move={model.move}
          finalFocus={model.finalFocus}
        />
        {quickStatuses(card.state).map((state) => (
          <Menu.Item key={state} disabled={!model.mutable} onClick={() => model.move(state)}>
            {shortcutLabels[state]}
          </Menu.Item>
        ))}
      </Menu.Group>
      {!model.mutable && !disabled ? (
        <p className="max-w-56 px-2 py-1 text-xs text-muted-foreground">
          Cancel this job’s active run before changing its status or deleting it.
        </p>
      ) : null}
      {model.shortcut ? (
        <>
          <Menu.Separator />
          <CrewAction
            context={context}
            shortcut={model.shortcut}
            disabled={disabled}
            perform={model.performCrew}
          />
        </>
      ) : null}
      <Menu.Separator />
      <Menu.Item disabled={!card.url} onClick={model.copyLink}>
        <Link size={15} />
        Copy job posting link
      </Menu.Item>
      <Menu.Separator />
      <Menu.Item variant="destructive" disabled={!model.mutable} onClick={model.requestDelete}>
        <Trash2 size={15} />
        Delete job…
      </Menu.Item>
    </>
  );
};
