import type { InputGroupTextProps } from '@/components/ui/input-group/types.ts';
import { cn } from '@/lib/utils.ts';

export function InputGroupText({ className, ...props }: InputGroupTextProps) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}
