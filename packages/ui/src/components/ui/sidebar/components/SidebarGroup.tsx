import type { SidebarGroupProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarGroup({ className, ...props }: SidebarGroupProps) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn(
        'primitive:relative primitive:flex primitive:w-full primitive:min-w-0 primitive:flex-col primitive:p-2',
        className,
      )}
      {...props}
    />
  );
}
