import type { TextareaProps } from '@/components/ui/textarea/types.ts';
import { cn } from '@/lib/utils';

export const Textarea = ({ className, rows = 3, ...props }: TextareaProps) => {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(
        'primitive:flex primitive:field-sizing-fixed primitive:min-h-[38px] primitive:w-full primitive:resize-y primitive:rounded-[10px_11px_10px_9px] primitive:border-0 primitive:px-[11px] primitive:py-2 primitive:text-body primitive:leading-[1.55] primitive:font-normal primitive:text-foreground primitive:shadow-sunken primitive:transition-[color,box-shadow,opacity] primitive:outline-none primitive:[background:var(--sunken-fill)] primitive:placeholder:text-faint primitive:disabled:cursor-not-allowed primitive:disabled:opacity-50 primitive:data-disabled:cursor-not-allowed primitive:data-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
};
