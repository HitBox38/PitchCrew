import type { InputGroupInputProps } from '@/components/ui/input-group/types.ts';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { cn } from '@/lib/utils.ts';

export function InputGroupInput({ className, ...props }: InputGroupInputProps) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        'primitive:flex-1 primitive:rounded-none primitive:border-0 primitive:shadow-none primitive:ring-0 primitive:[background:transparent] primitive:focus-visible:ring-0 primitive:aria-invalid:ring-0',
        className,
      )}
      {...props}
    />
  );
}
