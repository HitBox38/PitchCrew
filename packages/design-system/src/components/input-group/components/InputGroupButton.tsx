import { Button } from '../../button/components/Button.tsx';
import { inputGroupButtonVariants } from '../constants.ts';
import type { InputGroupButtonProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const InputGroupButton = ({
  className,
  type = 'button',
  variant = 'ghost',
  size = 'xs',
  ...props
}: InputGroupButtonProps) => {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
};
