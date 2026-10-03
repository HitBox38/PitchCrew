import type { InputGroupTextProps } from '@/components/ui/input-group/types.ts';
import { cn } from '@/lib/utils.ts';

export function InputGroupText({ className, ...props }: InputGroupTextProps) {
  return (
    <span
      className={cn(
        "primitive:flex primitive:items-center primitive:gap-2 primitive:text-sm primitive:text-muted-foreground primitive:[&_svg]:pointer-events-none primitive:[&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}
