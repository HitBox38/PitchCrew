import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';

export const DesktopUpdateActions = () => {
  const state = useWorkspaceStore((store) => store.desktopUpdate);
  const download = useWorkspaceStore((store) => store.downloadDesktopUpdate);
  const install = useWorkspaceStore((store) => store.installDesktopUpdate);
  if (!state?.enabled) return null;
  const busy = state.status === 'downloading' || state.status === 'installing';
  const ready = !!state.downloadedVersion;
  const label =
    state.status === 'installing'
      ? 'Restarting…'
      : state.status === 'downloading'
        ? `Downloading… ${state.downloadPercent ?? 0}%`
        : ready
          ? 'Install and restart'
          : 'Download update';
  return (
    <div className="flex flex-col gap-2">
      {state.availableVersion ? (
        <Button
          disabled={busy || state.status === 'checking'}
          onClick={() => void (ready ? install() : download())}
        >
          {label}
        </Button>
      ) : null}
      <output className="text-sm text-muted-foreground" aria-live="polite">
        {state.message}
      </output>
      {ready ? (
        <p className="text-sm text-muted-foreground">
          Restarting interrupts running agents. Your work stays saved.
        </p>
      ) : null}
    </div>
  );
};
