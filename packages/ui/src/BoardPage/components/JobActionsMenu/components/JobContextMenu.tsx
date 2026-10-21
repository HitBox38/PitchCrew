import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu/index.tsx';
import { useJobActionsMenu } from '../hooks/useJobActionsMenu.ts';
import type { JobActionsMenuProps } from '../types.ts';
import type { ReactElement } from 'react';
import { JobMenuItems } from './JobMenuItems.tsx';

export const JobContextMenu = (props: JobActionsMenuProps & { children: ReactElement }) => {
  const model = useJobActionsMenu(props);
  return (
    <ContextMenu disabled={props.disabled} onOpenChange={model.menuOpenChange}>
      <ContextMenuTrigger render={props.children} />
      <ContextMenuContent
        className="min-w-56"
        aria-label="Job actions"
        finalFocus={() =>
          model.finalFocus()
            ? (document
                .getElementById(`board-job-${props.card.id}`)
                ?.querySelector<HTMLButtonElement>('.job-card') ?? true)
            : false
        }
      >
        <JobMenuItems card={props.card} disabled={props.disabled} model={model} context />
      </ContextMenuContent>
    </ContextMenu>
  );
};
