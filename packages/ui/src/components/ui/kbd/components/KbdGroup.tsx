import type { KbdGroupProps } from '@/components/ui/kbd/types.ts';
import { cn } from '@/lib/utils';

export function KbdGroup({ className, ...props }: KbdGroupProps) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    />
  );
}
