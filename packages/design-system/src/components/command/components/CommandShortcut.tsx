import type { CommandShortcutProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const CommandShortcut = ({ className, ...props }: CommandShortcutProps) => {
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
};
