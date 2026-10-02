import { inputGroupAddonVariants } from '@/components/ui/input-group/constants.ts';
import type { InputGroupAddonProps } from '@/components/ui/input-group/types.ts';
import { cn } from '@/lib/utils.ts';

export function InputGroupAddon({
  className,
  align = 'inline-start',
  ...props
}: InputGroupAddonProps) {
  return (
    <div
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      {...props}
    />
  );
}
