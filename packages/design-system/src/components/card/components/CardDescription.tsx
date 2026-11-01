import type { CardDescriptionProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const CardDescription = ({ className, ...props }: CardDescriptionProps) => {
  return (
    <div
      data-slot="card-description"
      className={cn('primitive:text-sm primitive:text-muted-foreground', className)}
      {...props}
    />
  );
};
