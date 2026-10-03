import type { TextareaProps } from '@/components/ui/textarea/types.ts';
import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'primitive:flex primitive:field-sizing-content primitive:min-h-16 primitive:w-full primitive:rounded-md primitive:border primitive:border-input primitive:bg-transparent primitive:px-3 primitive:py-2 primitive:text-base primitive:shadow-xs primitive:transition-[color,box-shadow] primitive:outline-none primitive:placeholder:text-muted-foreground primitive:focus-visible:border-ring primitive:focus-visible:ring-[3px] primitive:focus-visible:ring-ring/50 primitive:disabled:cursor-not-allowed primitive:disabled:opacity-50 primitive:aria-invalid:border-destructive primitive:aria-invalid:ring-destructive/20 primitive:md:text-sm primitive:dark:bg-input/30 primitive:dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
}
