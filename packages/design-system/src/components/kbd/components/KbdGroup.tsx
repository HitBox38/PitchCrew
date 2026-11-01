import type { KbdGroupProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const KbdGroup = ({ className, ...props }: KbdGroupProps) => {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn('primitive:inline-flex primitive:items-center primitive:gap-1', className)}
      {...props}
    />
  );
};
