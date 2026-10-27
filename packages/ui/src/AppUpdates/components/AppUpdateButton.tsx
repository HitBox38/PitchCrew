import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import { Download, RefreshCw, RotateCw } from 'lucide-react';
import { useId, type RefObject } from 'react';
import { cn } from '@/lib/utils.ts';
import type { useUpdateControl } from '../hooks/useUpdateControl.ts';
import { UpdateTooltip } from './UpdateTooltip.tsx';

export const AppUpdateButton = ({
  control,
  trigger,
}: {
  control: ReturnType<typeof useUpdateControl>;
  trigger: RefObject<HTMLButtonElement | null>;
}) => {
  const tooltipId = useId();
  const { state, isMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;
  const Icon = control.ready ? RotateCw : control.visible ? Download : RefreshCw;
  return (
    <SidebarMenuButton
      ref={trigger}
      type="button"
      aria-label={control.label}
      aria-describedby={tooltipId}
      aria-disabled={control.disabled}
      aria-busy={control.busy || control.checking}
      onClick={control.activate}
      className={cn(
        'pointer-events-auto size-8 shrink-0 justify-center p-2 aria-disabled:opacity-100',
        control.visible && 'sidebar-update-button',
      )}
      tooltip={{
        id: tooltipId,
        role: 'tooltip',
        hidden: false,
        side: collapsed ? 'right' : 'top',
        sideOffset: 8,
        className: control.visible
          ? 'max-w-[min(20rem,calc(100vw-2rem))] p-3 leading-relaxed'
          : undefined,
        children: control.visible ? <UpdateTooltip {...control} /> : control.label,
      }}
    >
      {control.progress !== null ? (
        <span
          aria-hidden="true"
          className="sidebar-update-progress"
          style={{ width: `${control.progress}%` }}
        />
      ) : null}
      <Icon
        aria-hidden="true"
        className={control.checking ? 'animate-spin motion-reduce:animate-none' : undefined}
      />
      <span className="sr-only">{control.label}</span>
    </SidebarMenuButton>
  );
};
