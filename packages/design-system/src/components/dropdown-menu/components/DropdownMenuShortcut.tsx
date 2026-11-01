import type { DropdownMenuShortcutProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const DropdownMenuShortcut = ({ className, ...props }: DropdownMenuShortcutProps) => {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        'primitive:ml-auto primitive:text-xs primitive:tracking-widest primitive:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
};
