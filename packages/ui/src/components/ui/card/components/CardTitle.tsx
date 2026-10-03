import type { CardTitleProps } from '@/components/ui/card/types.ts';
import { cn } from '@/lib/utils';

export function CardTitle({ className, ...props }: CardTitleProps) {
  return (
    <div
      data-slot="card-title"
      className={cn('primitive:leading-none primitive:font-semibold', className)}
      {...props}
    />
  );
}
