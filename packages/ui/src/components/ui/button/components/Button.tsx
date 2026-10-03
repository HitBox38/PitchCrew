import { buttonVariants } from '@/components/ui/button/constants.ts';
import type { ButtonProps } from '@/components/ui/button/types.ts';
import { cn } from '@/lib/utils';
import { Button as ButtonPrimitive } from '@base-ui/react/button';

export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
