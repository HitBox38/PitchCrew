import type { SidebarMenuActionProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

export function SidebarMenuAction({
  className,
  render,
  showOnHover = false,
  ...props
}: SidebarMenuActionProps) {
  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      {
        className: cn(
          'primitive:absolute primitive:top-1.5 primitive:right-1 primitive:flex primitive:aspect-square primitive:w-5 primitive:items-center primitive:justify-center primitive:rounded-md primitive:p-0 primitive:text-sidebar-foreground primitive:ring-sidebar-ring primitive:outline-hidden primitive:transition-transform primitive:peer-hover/menu-button:text-sidebar-accent-foreground primitive:hover:bg-sidebar-accent primitive:hover:text-sidebar-accent-foreground primitive:focus-visible:ring-2 primitive:[&>svg]:size-4 primitive:[&>svg]:shrink-0',
          // Increases the hit area of the button on mobile.
          'primitive:after:absolute primitive:after:-inset-2 primitive:md:after:hidden',
          'primitive:peer-data-[size=sm]/menu-button:top-1',
          'primitive:peer-data-[size=default]/menu-button:top-1.5',
          'primitive:peer-data-[size=lg]/menu-button:top-2.5',
          'primitive:group-data-[collapsible=icon]:hidden',
          showOnHover &&
            'primitive:group-focus-within/menu-item:opacity-100 primitive:group-hover/menu-item:opacity-100 primitive:peer-data-active/menu-button:text-sidebar-accent-foreground primitive:aria-expanded:opacity-100 primitive:md:opacity-0',
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: 'sidebar-menu-action',
      sidebar: 'menu-action',
    },
  });
}
