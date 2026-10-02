import { Button } from '@/components/ui/button/components/Button.tsx';
import { inputGroupButtonVariants } from '@/components/ui/input-group/constants.ts';
import type { InputGroupButtonProps } from '@/components/ui/input-group/types.ts';
import { cn } from '@/lib/utils.ts';

export function InputGroupButton({
  className,
  type = 'button',
  variant = 'ghost',
  size = 'xs',
  ...props
}: InputGroupButtonProps) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}
