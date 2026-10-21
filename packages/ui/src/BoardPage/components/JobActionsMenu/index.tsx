import { JobMenuItems } from './components/JobMenuItems.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu/index.tsx';
import { MoreHorizontal } from 'lucide-react';
import { useJobActionsMenu } from './hooks/useJobActionsMenu.ts';
import type { JobActionsMenuProps } from './types.ts';

export const JobActionsMenu = (props: JobActionsMenuProps) => {
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
        <JobMenuItems card={card} disabled={disabled} model={model} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
