import type { CardProps } from '@/components/ui/card/types.ts';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
}
