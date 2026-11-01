import { DropdownMenuLabel } from '../../dropdown-menu/components/DropdownMenuLabel.tsx';
import type { DropdownMenuLabelProps } from '../../dropdown-menu/types.ts';

export const ContextMenuLabel = (props: DropdownMenuLabelProps) => (
  <DropdownMenuLabel data-slot="context-menu-label" {...props} />
);
