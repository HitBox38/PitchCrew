import type { SidebarMenuSubButtonProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

export function SidebarMenuSubButton({
  render,
  size = 'md',
  isActive = false,
  className,
  ...props
}: SidebarMenuSubButtonProps) {
  return useRender({
    defaultTagName: 'a',
    props: mergeProps<'a'>(
      {
        className: cn(
          'primitive:flex primitive:h-7 primitive:min-w-0 primitive:-translate-x-px primitive:items-center primitive:gap-2 primitive:overflow-hidden primitive:rounded-md primitive:px-2 primitive:text-sidebar-foreground primitive:ring-sidebar-ring primitive:outline-hidden primitive:hover:bg-sidebar-accent primitive:hover:text-sidebar-accent-foreground primitive:focus-visible:ring-2 primitive:active:bg-sidebar-accent primitive:active:text-sidebar-accent-foreground primitive:disabled:pointer-events-none primitive:disabled:opacity-50 primitive:aria-disabled:pointer-events-none primitive:aria-disabled:opacity-50 primitive:[&>span:last-child]:truncate primitive:[&>svg]:size-4 primitive:[&>svg]:shrink-0 primitive:[&>svg]:text-sidebar-accent-foreground',
          'primitive:data-active:bg-sidebar-accent primitive:data-active:text-sidebar-accent-foreground',
          size === 'sm' && 'primitive:text-xs',
          size === 'md' && 'primitive:text-sm',
          'primitive:group-data-[collapsible=icon]:hidden',
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: 'sidebar-menu-sub-button',
      sidebar: 'menu-sub-button',
      size,
      active: isActive,
    },
  });
}
