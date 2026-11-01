import { SidebarMenuButton, useSidebar } from '@pitchcrew/design-system/sidebar';
import { Download, RotateCw } from 'lucide-react';
import { useId, type RefObject } from 'react';
import type { useUpdateControl } from '../hooks/useUpdateControl.ts';
import { UpdateTooltip } from './UpdateTooltip.tsx';

/** Download update, its progress, or Restart to update, with the release notes in a tooltip. */
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
  const Icon = control.ready ? RotateCw : Download;
  return (
    <SidebarMenuButton
      ref={trigger}
      type="button"
      aria-label={control.label}
      aria-describedby={tooltipId}
      aria-disabled={control.disabled}
      aria-busy={control.busy || control.checking}
      onClick={control.activate}
      className="sidebar-update-button aria-disabled:opacity-100"
      tooltip={{
        id: tooltipId,
        role: 'tooltip',
        hidden: false,
        side: collapsed ? 'right' : 'top',
        sideOffset: 8,
        className: 'max-w-[min(20rem,calc(100vw-2rem))] p-3 leading-relaxed',
        children: <UpdateTooltip {...control} />,
      }}
    >
      {control.progress !== null ? (
        <span
          aria-hidden="true"
          className="sidebar-update-progress"
          style={{ width: `${control.progress}%` }}
        />
      ) : null}
      <Icon aria-hidden="true" />
      <span>{control.label}</span>
    </SidebarMenuButton>
  );
};
