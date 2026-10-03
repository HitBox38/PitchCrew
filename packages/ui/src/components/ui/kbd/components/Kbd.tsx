import type { KbdProps } from '@/components/ui/kbd/types.ts';
import { cn } from '@/lib/utils';

export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'primitive:pointer-events-none primitive:inline-flex primitive:h-5 primitive:w-fit primitive:min-w-5 primitive:items-center primitive:justify-center primitive:gap-1 primitive:rounded-sm primitive:bg-muted primitive:px-1 primitive:font-sans primitive:text-xs primitive:font-medium primitive:text-muted-foreground primitive:select-none',
        "primitive:[&_svg:not([class*='size-'])]:size-3",
        'primitive:[[data-slot=tooltip-content]_&]:bg-background/20 primitive:[[data-slot=tooltip-content]_&]:text-background primitive:dark:[[data-slot=tooltip-content]_&]:bg-background/10',
        className,
      )}
      {...props}
    />
  );
}
