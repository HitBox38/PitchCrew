import type { DropdownMenuTriggerProps } from '@/components/ui/dropdown-menu/types.ts';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

export function DropdownMenuTrigger({ ...props }: DropdownMenuTriggerProps) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}
