import type { DropdownMenuCheckboxItemProps } from '@/components/ui/dropdown-menu/types.ts';
import { cn } from '@/lib/utils';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { CheckIcon } from 'lucide-react';

export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: DropdownMenuCheckboxItemProps) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "primitive:relative primitive:flex primitive:cursor-default primitive:items-center primitive:gap-2 primitive:rounded-sm primitive:py-1.5 primitive:pr-2 primitive:pl-8 primitive:text-sm primitive:outline-hidden primitive:select-none primitive:focus:bg-accent primitive:focus:text-accent-foreground primitive:data-disabled:pointer-events-none primitive:data-disabled:opacity-50 primitive:[&_svg]:pointer-events-none primitive:[&_svg]:shrink-0 primitive:[&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="primitive:pointer-events-none primitive:absolute primitive:left-2 primitive:flex primitive:size-3.5 primitive:items-center primitive:justify-center">
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className="primitive:size-4" />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}
