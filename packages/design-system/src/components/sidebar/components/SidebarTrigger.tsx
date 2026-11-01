import { Button } from '../../button/components/Button.tsx';
import { useSidebar } from '../hooks/useSidebar.ts';
import type { SidebarTriggerProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { PanelLeftIcon } from 'lucide-react';

export const SidebarTrigger = ({ className, onClick, ...props }: SidebarTriggerProps) => {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn('primitive:size-7', className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="primitive:sr-only">Toggle Sidebar</span>
    </Button>
  );
};
