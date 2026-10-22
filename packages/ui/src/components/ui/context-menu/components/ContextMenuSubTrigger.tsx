import { DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu/components/DropdownMenuSubTrigger.tsx';
import type { DropdownMenuSubTriggerProps } from '@/components/ui/dropdown-menu/types.ts';

export const ContextMenuSubTrigger = (props: DropdownMenuSubTriggerProps) => (
  <DropdownMenuSubTrigger data-slot="context-menu-sub-trigger" {...props} />
);
