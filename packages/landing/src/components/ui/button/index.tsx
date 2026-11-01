'use client';

import { Button as SharedButton, type ButtonProps } from '@pitchcrew/design-system/button';
import { cn } from '@pitchcrew/design-system/utils';

export const Button = ({
  className,
  variant = 'primary',
  ...props
}: Omit<ButtonProps, 'variant'> & { variant?: 'primary' | 'secondary' | 'ghost' }) => {
  return (
    <SharedButton
      variant={variant === 'primary' ? 'default' : variant}
      className={cn('button h-auto', `button-${variant}`, className)}
      {...props}
    />
  );
};
