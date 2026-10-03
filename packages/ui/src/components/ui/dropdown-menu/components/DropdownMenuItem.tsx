import type { DropdownMenuItemProps } from '@/components/ui/dropdown-menu/types.ts';
import { cn } from '@/lib/utils';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

export function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: DropdownMenuItemProps) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "primitive:relative primitive:flex primitive:cursor-default primitive:items-center primitive:gap-2 primitive:rounded-sm primitive:px-2 primitive:py-1.5 primitive:text-sm primitive:outline-hidden primitive:select-none primitive:focus:bg-accent primitive:focus:text-accent-foreground primitive:data-inset:pl-8 primitive:data-[variant=destructive]:text-destructive primitive:data-[variant=destructive]:focus:bg-destructive/10 primitive:data-[variant=destructive]:focus:text-destructive primitive:dark:data-[variant=destructive]:focus:bg-destructive/20 primitive:data-disabled:pointer-events-none primitive:data-disabled:opacity-50 primitive:[&_svg]:pointer-events-none primitive:[&_svg]:shrink-0 primitive:[&_svg:not([class*='size-'])]:size-4 primitive:[&_svg:not([class*='text-'])]:text-muted-foreground primitive:data-[variant=destructive]:*:[svg]:text-destructive!",
        className,
      )}
      {...props}
    />
  );
}
