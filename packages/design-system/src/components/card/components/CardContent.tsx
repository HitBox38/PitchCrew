import type { CardContentProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const CardContent = ({ className, ...props }: CardContentProps) => {
  return <div data-slot="card-content" className={cn('primitive:px-6', className)} {...props} />;
};
