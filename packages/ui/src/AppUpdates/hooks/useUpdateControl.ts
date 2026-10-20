import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useManualUpdateCheck } from './useManualUpdateCheck.ts';
import { updateControl } from '../helpers.ts';

export function useUpdateControl() {
  const info = useWorkspaceStore((store) => store.appUpdate);
  const desktop = useWorkspaceStore((store) => store.desktopUpdate);
  const dismissed = useWorkspaceStore((store) => store.dismissedAppUpdate);
  const checking = useWorkspaceStore((store) => store.checkingAppUpdate);
  const dismiss = useWorkspaceStore((store) => store.dismissAppUpdate);
  const download = useWorkspaceStore((store) => store.downloadDesktopUpdate);
  const install = useWorkspaceStore((store) => store.installDesktopUpdate);
  const check = useManualUpdateCheck();
  const control = updateControl(info, desktop, dismissed, checking);
  const activate = () => {
    if (control.disabled) return;
    if (!control.visible) void check();
    else if (control.native) void (control.ready ? install() : download());
    else if (control.release) window.open(control.release.url, '_blank', 'noopener,noreferrer');
  };
  return { ...control, dismiss, activate };
}
