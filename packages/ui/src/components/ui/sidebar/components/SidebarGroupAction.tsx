import type { SidebarGroupActionProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

export function SidebarGroupAction({ className, render, ...props }: SidebarGroupActionProps) {
  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      {
        className: cn(
          'primitive:absolute primitive:top-3.5 primitive:right-3 primitive:flex primitive:aspect-square primitive:w-5 primitive:items-center primitive:justify-center primitive:rounded-md primitive:p-0 primitive:text-sidebar-foreground primitive:ring-sidebar-ring primitive:outline-hidden primitive:transition-transform primitive:hover:bg-sidebar-accent primitive:hover:text-sidebar-accent-foreground primitive:focus-visible:ring-2 primitive:[&>svg]:size-4 primitive:[&>svg]:shrink-0',
          // Increases the hit area of the button on mobile.
          'primitive:after:absolute primitive:after:-inset-2 primitive:md:after:hidden',
          'primitive:group-data-[collapsible=icon]:hidden',
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: 'sidebar-group-action',
      sidebar: 'group-action',
    },
  });
}
