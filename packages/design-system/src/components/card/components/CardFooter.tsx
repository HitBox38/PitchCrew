import type { CardFooterProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const CardFooter = ({ className, ...props }: CardFooterProps) => {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'primitive:flex primitive:items-center primitive:px-6 primitive:[.border-t]:pt-6',
        className,
      )}
      {...props}
    />
  );
};
