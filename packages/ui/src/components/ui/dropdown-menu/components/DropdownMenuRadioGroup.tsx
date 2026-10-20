import type { DropdownMenuRadioGroupProps } from '@/components/ui/dropdown-menu/types.ts';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

export const DropdownMenuRadioGroup = ({ ...props }: DropdownMenuRadioGroupProps) => {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
};
