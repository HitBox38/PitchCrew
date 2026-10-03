import type { SidebarContentProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarContent({ className, ...props }: SidebarContentProps) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        'primitive:flex primitive:min-h-0 primitive:flex-1 primitive:flex-col primitive:gap-2 primitive:overflow-auto primitive:group-data-[collapsible=icon]:overflow-hidden',
        className,
      )}
      {...props}
    />
  );
}
