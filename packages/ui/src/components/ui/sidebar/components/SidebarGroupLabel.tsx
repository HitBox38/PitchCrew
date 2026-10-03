import type { SidebarGroupLabelProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

export function SidebarGroupLabel({ className, render, ...props }: SidebarGroupLabelProps) {
  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      {
        className: cn(
          'primitive:flex primitive:h-8 primitive:shrink-0 primitive:items-center primitive:rounded-md primitive:px-2 primitive:text-xs primitive:font-medium primitive:text-sidebar-foreground/70 primitive:ring-sidebar-ring primitive:outline-hidden primitive:transition-[margin,opacity] primitive:duration-200 primitive:ease-linear primitive:focus-visible:ring-2 primitive:[&>svg]:size-4 primitive:[&>svg]:shrink-0',
          'primitive:group-data-[collapsible=icon]:-mt-8 primitive:group-data-[collapsible=icon]:opacity-0',
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: 'sidebar-group-label',
      sidebar: 'group-label',
    },
  });
}
