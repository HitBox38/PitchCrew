import type { CardContentProps } from '@/components/ui/card/types.ts';
import { cn } from '@/lib/utils';

export const CardContent = ({ className, ...props }: CardContentProps) => {
  return <div data-slot="card-content" className={cn('primitive:px-6', className)} {...props} />;
};
