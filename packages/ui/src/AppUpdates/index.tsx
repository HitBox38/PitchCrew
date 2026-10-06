import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { X, Download } from 'lucide-react';
import { ReleaseLink } from './components/ReleaseLink.tsx';
import { useAutomaticUpdates } from './hooks/useAutomaticUpdates.ts';

export function AppUpdates() {
  useAutomaticUpdates();
  const info = useWorkspaceStore((state) => state.appUpdate);
  const dismissed = useWorkspaceStore((state) => state.dismissedAppUpdate);
  const dismiss = useWorkspaceStore((state) => state.dismissAppUpdate);
  if (info?.status !== 'available' || !info.latest || dismissed === info.latest.commit) return null;
  return (
    <div className="info-note flex flex-wrap items-center gap-3" aria-live="polite">
      <Download size={17} aria-hidden="true" />
      <span className="flex-1">A newer Pitchcrew build is available.</span>
      <ReleaseLink url={info.latest.url} />
      <Button variant="ghost" size="icon-sm" aria-label="Dismiss update notice" onClick={dismiss}>
        <X size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}
