import { inputGroupAddonVariants } from '../constants.ts';
import type { InputGroupAddonProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const InputGroupAddon = ({
  className,
  align = 'inline-start',
  ...props
}: InputGroupAddonProps) => {
  return (
    <div
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      {...props}
    />
  );
};
