import type { CommandShortcutProps } from '@/components/ui/command/types.ts';
import { cn } from '@/lib/utils';

export function CommandShortcut({ className, ...props }: CommandShortcutProps) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        'primitive:ml-auto primitive:text-xs primitive:tracking-widest primitive:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
