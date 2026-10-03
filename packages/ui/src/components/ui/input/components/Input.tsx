import type { InputProps } from '@/components/ui/input/types.ts';
import { cn } from '@/lib/utils';
import { Input as InputPrimitive } from '@base-ui/react/input';

export function Input({ className, type, ...props }: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'primitive:h-9 primitive:w-full primitive:min-w-0 primitive:rounded-md primitive:border primitive:border-input primitive:bg-transparent primitive:px-3 primitive:py-1 primitive:text-base primitive:shadow-xs primitive:transition-[color,box-shadow] primitive:outline-none primitive:selection:bg-primary primitive:selection:text-primary-foreground primitive:file:inline-flex primitive:file:h-7 primitive:file:border-0 primitive:file:bg-transparent primitive:file:text-sm primitive:file:font-medium primitive:file:text-foreground primitive:placeholder:text-muted-foreground primitive:disabled:pointer-events-none primitive:disabled:cursor-not-allowed primitive:disabled:opacity-50 primitive:md:text-sm primitive:dark:bg-input/30',
        'primitive:focus-visible:border-ring primitive:focus-visible:ring-[3px] primitive:focus-visible:ring-ring/50',
        'primitive:aria-invalid:border-destructive primitive:aria-invalid:ring-destructive/20 primitive:dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
}
