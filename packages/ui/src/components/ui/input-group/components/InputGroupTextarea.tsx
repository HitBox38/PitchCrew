import type { InputGroupTextareaProps } from '@/components/ui/input-group/types.ts';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import { cn } from '@/lib/utils.ts';

export const InputGroupTextarea = ({ className, ...props }: InputGroupTextareaProps) => {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        'primitive:flex-1 primitive:resize-none primitive:rounded-none primitive:border-0 primitive:py-2 primitive:shadow-none primitive:ring-0 primitive:[background:transparent] primitive:focus-visible:ring-0 primitive:aria-invalid:ring-0',
        className,
      )}
      {...props}
    />
  );
};
