import { MoreHorizontal } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import type { ProfileTreeNode } from '../types.ts';
import { ProfileTreeMenuItems, type ProfileTreeRowActions } from './ProfileTreeMenuItems.tsx';

export type { ProfileTreeRowActions } from './ProfileTreeMenuItems.tsx';

export const ProfileTreeRowMenu = ({
  node,
  tabIndex,
  working,
  blocked,
  actions,
}: {
  node: ProfileTreeNode;
  tabIndex: number;
  working: boolean;
  blocked?: string;
  actions: ProfileTreeRowActions;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={<Button variant="ghost" size="icon-sm" className="profile-row-menu" />}
      aria-label={`Actions for ${node.label}`}
      tabIndex={tabIndex}
    >
      <MoreHorizontal size={14} />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-60">
      <ProfileTreeMenuItems node={node} working={working} blocked={blocked} actions={actions} />
    </DropdownMenuContent>
  </DropdownMenu>
);
