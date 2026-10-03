import type { CardProps } from '@/components/ui/card/types.ts';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        'primitive:flex primitive:flex-col primitive:gap-6 primitive:rounded-xl primitive:border primitive:bg-card primitive:py-6 primitive:text-card-foreground primitive:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}
