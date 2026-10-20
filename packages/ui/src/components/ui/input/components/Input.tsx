import type { InputProps } from '@/components/ui/input/types.ts';
import { cn } from '@/lib/utils';
import { Input as InputPrimitive } from '@base-ui/react/input';

export const Input = ({ className, type, ...props }: InputProps) => {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'primitive:h-[38px] primitive:w-full primitive:min-w-0 primitive:rounded-[10px_11px_10px_9px] primitive:border-0 primitive:px-[11px] primitive:py-2 primitive:text-body primitive:font-normal primitive:text-foreground primitive:shadow-sunken primitive:transition-[color,box-shadow,opacity] primitive:outline-none primitive:[background:var(--sunken-fill)] primitive:selection:bg-primary primitive:selection:text-primary-foreground primitive:file:inline-flex primitive:file:h-7 primitive:file:border-0 primitive:file:bg-transparent primitive:file:text-label primitive:file:font-semibold primitive:file:text-foreground primitive:placeholder:text-faint primitive:disabled:pointer-events-none primitive:disabled:cursor-not-allowed primitive:disabled:opacity-50 primitive:data-disabled:pointer-events-none primitive:data-disabled:cursor-not-allowed primitive:data-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
};
