import { SidebarMenuButton } from './SidebarMenuButton.tsx';
import { useSidebar } from '../hooks/useSidebar.ts';
import type { SidebarMenuButtonProps } from '../types.ts';
import { cn } from '@/lib/utils';

export function SidebarIconButton({
  label,
  className,
  children,
  ...props
}: SidebarMenuButtonProps & { label: string }) {
  const { state, isMobile } = useSidebar();
  return (
    <SidebarMenuButton
      {...props}
      className={cn('size-8 shrink-0 justify-center p-2', className)}
      aria-label={label}
      tooltip={{
        children: label,
        hidden: false,
        side: state === 'collapsed' && !isMobile ? 'right' : 'top',
      }}
    >
      {children}
      <span className="sr-only">{label}</span>
    </SidebarMenuButton>
  );
}
