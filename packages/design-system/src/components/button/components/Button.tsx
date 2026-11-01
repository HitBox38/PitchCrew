import { buttonVariants } from '../constants.ts';
import type { ButtonProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { Button as ButtonPrimitive } from '@base-ui/react/button';

export const Button = ({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonProps) => {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
};
