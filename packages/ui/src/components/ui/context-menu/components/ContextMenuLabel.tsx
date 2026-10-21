import { DropdownMenuLabel } from '@/components/ui/dropdown-menu/components/DropdownMenuLabel.tsx';
import type { DropdownMenuLabelProps } from '@/components/ui/dropdown-menu/types.ts';

export const ContextMenuLabel = (props: DropdownMenuLabelProps) => (
  <DropdownMenuLabel data-slot="context-menu-label" {...props} />
);
