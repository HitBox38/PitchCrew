import type { InputGroupTextareaProps } from '@/components/ui/input-group/types.ts';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import { cn } from '@/lib/utils.ts';

export function InputGroupTextarea({ className, ...props }: InputGroupTextareaProps) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        'flex-1 resize-none rounded-none border-0 bg-transparent py-2 shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent',
        className,
      )}
      {...props}
    />
  );
}
