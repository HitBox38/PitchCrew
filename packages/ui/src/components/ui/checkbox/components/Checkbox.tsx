import type { CheckboxProps } from '@/components/ui/checkbox/types.ts';
import { cn } from '@/lib/utils';
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { CheckIcon } from 'lucide-react';

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer primitive:size-4 primitive:shrink-0 primitive:rounded-[4px] primitive:border primitive:border-input primitive:shadow-xs primitive:transition-shadow primitive:outline-none primitive:focus-visible:border-ring primitive:focus-visible:ring-[3px] primitive:focus-visible:ring-ring/50 primitive:disabled:cursor-not-allowed primitive:disabled:opacity-50 primitive:aria-invalid:border-destructive primitive:aria-invalid:ring-destructive/20 primitive:dark:bg-input/30 primitive:dark:aria-invalid:ring-destructive/40 primitive:data-checked:border-primary primitive:data-checked:bg-primary primitive:data-checked:text-primary-foreground primitive:dark:data-checked:bg-primary primitive:data-disabled:cursor-not-allowed primitive:data-disabled:opacity-50',
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
