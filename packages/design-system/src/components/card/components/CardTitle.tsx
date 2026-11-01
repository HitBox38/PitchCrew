import type { CardTitleProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const CardTitle = ({ className, ...props }: CardTitleProps) => {
  return (
    <div
      data-slot="card-title"
      className={cn('primitive:leading-none primitive:font-semibold', className)}
      {...props}
    />
  );
};
