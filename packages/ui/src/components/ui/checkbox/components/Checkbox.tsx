import type { CheckboxProps } from '@/components/ui/checkbox/types.ts';
import { cn } from '@/lib/utils';
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { CheckIcon } from 'lucide-react';

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer primitive:size-[18px] primitive:shrink-0 primitive:cursor-pointer primitive:rounded-[5px] primitive:border-0 primitive:shadow-sunken primitive:transition-[background,box-shadow,opacity] primitive:outline-none primitive:[background:var(--sunken-fill)] primitive:disabled:cursor-not-allowed primitive:disabled:opacity-50 primitive:data-[indeterminate]:text-primary-foreground primitive:data-[indeterminate]:shadow-glaze primitive:data-[indeterminate]:[background:var(--glaze-fill)] primitive:data-checked:text-primary-foreground primitive:data-checked:shadow-glaze primitive:data-checked:[background:var(--glaze-fill)] primitive:data-disabled:cursor-not-allowed primitive:data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="primitive:grid primitive:place-content-center primitive:text-current primitive:transition-none"
      >
        <CheckIcon className="primitive:size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
