import { sidebarMenuButtonVariants } from '@/components/ui/sidebar/constants.ts';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import type { SidebarMenuButtonProps } from '@/components/ui/sidebar/types.ts';
import { Tooltip } from '@/components/ui/tooltip/components/Tooltip.tsx';
import { TooltipContent } from '@/components/ui/tooltip/components/TooltipContent.tsx';
import { TooltipTrigger } from '@/components/ui/tooltip/components/TooltipTrigger.tsx';
import { cn } from '@/lib/utils';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

export function SidebarMenuButton({
  render,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const { isMobile, state } = useSidebar();
  const comp = useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      { className: cn(sidebarMenuButtonVariants({ variant, size }), className) },
      props,
    ),
    render: !tooltip ? render : <TooltipTrigger render={render} />,
    state: {
      slot: 'sidebar-menu-button',
      sidebar: 'menu-button',
      size,
      active: isActive,
    },
  });

  if (!tooltip) {
    return comp;
  }

  if (typeof tooltip === 'string') {
    tooltip = {
      children: tooltip,
    };
  }

  return (
    <Tooltip>
      {comp}
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== 'collapsed' || isMobile}
        {...tooltip}
      />
    </Tooltip>
  );
}
