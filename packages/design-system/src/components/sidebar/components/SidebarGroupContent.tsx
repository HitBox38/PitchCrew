import type { SidebarGroupContentProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const SidebarGroupContent = ({ className, ...props }: SidebarGroupContentProps) => {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn('primitive:w-full primitive:text-sm', className)}
      {...props}
    />
  );
};
