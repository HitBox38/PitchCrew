import type { CardDescriptionProps } from '@/components/ui/card/types.ts';
import { cn } from '@/lib/utils';

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return (
    <div
      data-slot="card-description"
      className={cn('primitive:text-sm primitive:text-muted-foreground', className)}
      {...props}
    />
  );
}
