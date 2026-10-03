import type { CardActionProps } from '@/components/ui/card/types.ts';
import { cn } from '@/lib/utils';

export function CardAction({ className, ...props }: CardActionProps) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        'primitive:col-start-2 primitive:row-span-2 primitive:row-start-1 primitive:self-start primitive:justify-self-end',
        className,
      )}
      {...props}
    />
  );
}
