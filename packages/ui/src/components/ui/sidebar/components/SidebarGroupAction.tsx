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
          'absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
          // Increases the hit area of the button on mobile.
          'after:absolute after:-inset-2 md:after:hidden',
          'group-data-[collapsible=icon]:hidden',
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
