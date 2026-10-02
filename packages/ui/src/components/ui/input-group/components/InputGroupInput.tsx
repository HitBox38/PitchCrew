import type { InputGroupInputProps } from '@/components/ui/input-group/types.ts';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { cn } from '@/lib/utils.ts';

export function InputGroupInput({ className, ...props }: InputGroupInputProps) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        'flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent',
        className,
      )}
      {...props}
    />
  );
}
