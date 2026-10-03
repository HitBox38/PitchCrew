import type { DropdownMenuShortcutProps } from '@/components/ui/dropdown-menu/types.ts';
import { cn } from '@/lib/utils';

export function DropdownMenuShortcut({ className, ...props }: DropdownMenuShortcutProps) {
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
}
