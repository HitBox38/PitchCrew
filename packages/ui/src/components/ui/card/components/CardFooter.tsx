import type { CardFooterProps } from '@/components/ui/card/types.ts';
import { cn } from '@/lib/utils';

export function CardFooter({ className, ...props }: CardFooterProps) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center px-6 [.border-t]:pt-6', className)}
      {...props}
    />
  );
}
