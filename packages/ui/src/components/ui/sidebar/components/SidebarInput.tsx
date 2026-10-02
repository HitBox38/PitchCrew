import { Input } from '@/components/ui/input/components/Input.tsx';
import type { SidebarInputProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarInput({ className, ...props }: SidebarInputProps) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn('h-8 w-full bg-background shadow-none', className)}
      {...props}
    />
  );
}
