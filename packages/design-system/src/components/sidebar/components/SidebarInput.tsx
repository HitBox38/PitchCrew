import { Input } from '../../input/components/Input.tsx';
import type { SidebarInputProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const SidebarInput = ({ className, ...props }: SidebarInputProps) => {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn(
        'primitive:h-8 primitive:w-full primitive:bg-background primitive:shadow-none',
        className,
      )}
      {...props}
    />
  );
};
