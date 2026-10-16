import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu/index.tsx';
import { ArrowUpRight, Link, MoreHorizontal, Trash2 } from 'lucide-react';
import { MoveToMenu } from './components/MoveToMenu.tsx';
import { CrewAction } from './components/CrewAction.tsx';
import { quickStatuses, shortcutLabels } from './helpers.ts';
import { useJobActionsMenu } from './hooks/useJobActionsMenu.ts';
import type { JobActionsMenuProps } from './types.ts';

export function JobActionsMenu(props: JobActionsMenuProps) {
  const { card, disabled } = props;
  const model = useJobActionsMenu(props);
  return (
    <DropdownMenu onOpenChange={model.menuOpenChange}>
      <DropdownMenuTrigger
        render={<Button className="job-actions-trigger icon-button" />}
        aria-label={`Actions for ${card.title} at ${card.company}`}
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <MoreHorizontal size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-56"
        aria-label="Job actions"
        finalFocus={model.finalFocus}
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={model.openDetails}>
            <ArrowUpRight size={15} />
            Open details
          </DropdownMenuItem>
          <MoveToMenu card={card} disabled={!model.mutable} move={model.move} />
          {quickStatuses(card.state).map((state) => (
            <DropdownMenuItem
              key={state}
              disabled={!model.mutable}
              onClick={() => model.move(state)}
            >
              {shortcutLabels[state]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {!model.mutable && !disabled ? (
          <p className="max-w-56 px-2 py-1 text-xs text-muted-foreground">
            Cancel this job’s active run before changing its status or deleting it.
          </p>
        ) : null}
        {model.shortcut ? (
          <>
            <DropdownMenuSeparator />
            <CrewAction shortcut={model.shortcut} disabled={disabled} perform={model.performCrew} />
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!card.url} onClick={model.copyLink}>
          <Link size={15} />
          Copy job posting link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={!model.mutable}
          onClick={model.requestDelete}
        >
          <Trash2 size={15} />
          Delete job…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
