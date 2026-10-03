import type { CardHeaderProps } from '@/components/ui/card/types.ts';
import { cn } from '@/lib/utils';

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'primitive:@container/card-header primitive:grid primitive:auto-rows-min primitive:grid-rows-[auto_auto] primitive:items-start primitive:gap-2 primitive:px-6 primitive:has-data-[slot=card-action]:grid-cols-[1fr_auto] primitive:[.border-b]:pb-6',
        className,
      )}
      {...props}
    />
  );
}
