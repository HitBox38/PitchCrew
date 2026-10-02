import { claySpring } from '@/AppMotion/constants.ts';
import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import { buttonVariants } from '@/components/ui/button/constants.ts';
import type { ButtonProps } from '@/components/ui/button/types.ts';
import { cn } from '@/lib/utils';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import * as m from 'motion/react-m';

export function Button({
  className,
  variant = 'default',
  size = 'default',
  render,
  ...props
}: ButtonProps) {
  const reduced = useAppReducedMotion();
  return (
    <ButtonPrimitive
      render={
        render ?? (
          <m.button
            whileHover={
              !reduced &&
              !props.disabled &&
              typeof className === 'string' &&
              className.split(' ').includes('button')
                ? { y: -1 }
                : undefined
            }
            whileTap={!reduced && !props.disabled ? { scale: 0.97, y: 0 } : undefined}
            transition={claySpring}
          />
        )
      }
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
