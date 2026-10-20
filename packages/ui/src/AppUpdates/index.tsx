import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Download, RefreshCw, RotateCw, X } from 'lucide-react';
import { useId, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useUpdateControl } from './hooks/useUpdateControl.ts';
import { UpdateTooltip } from './components/UpdateTooltip.tsx';

export const AppUpdates = () => {
  const control = useUpdateControl();
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const { state, isMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;
  const Icon = control.ready ? RotateCw : control.visible ? Download : RefreshCw;
  return (
    <SidebarMenuItem
      className={cn(
        'shrink-0',
        control.visible
          ? 'order-first w-full group-data-[collapsible=icon]:w-auto'
          : 'ml-auto group-data-[collapsible=icon]:ml-0',
      )}
    >
      <div className="relative flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
        <SidebarMenuButton
          ref={trigger}
          type="button"
          aria-label={control.label}
          aria-describedby={tooltipId}
          aria-disabled={control.disabled}
          aria-busy={control.busy || control.checking}
          onClick={control.activate}
          className={cn(
            'pointer-events-auto aria-disabled:opacity-100',
            control.visible
              ? 'sidebar-update-button h-9 flex-1 justify-center group-data-[collapsible=icon]:flex-none'
              : 'size-8 justify-center p-2',
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
          <span className={control.visible ? 'group-data-[collapsible=icon]:sr-only' : 'sr-only'}>
            {control.label}
          </span>
        </SidebarMenuButton>
        {control.visible ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="Dismiss update notice"
            title="Dismiss for this session"
            disabled={control.busy || control.checking}
            onClick={() => {
              control.dismiss();
              trigger.current?.focus();
            }}
          >
            <X aria-hidden="true" className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <output className="sr-only" aria-live="polite">
        {control.visible || control.checking ? `${control.label}. ${control.message ?? ''}` : ''}
      </output>
    </SidebarMenuItem>
  );
};
