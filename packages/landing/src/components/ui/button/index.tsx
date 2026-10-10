'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const buttonVariants = cva('button', {
  variants: {
    variant: { primary: 'button-primary', secondary: 'button-secondary', ghost: 'button-ghost' },
  },
  defaultVariants: { variant: 'primary' },
});

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonPrimitive.Props & {
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  return (
    <ButtonPrimitive
      type="button"
      className={twMerge(clsx(buttonVariants({ variant }), className))}
      {...props}
    />
  );
}
