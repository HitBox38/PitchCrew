import { Switch } from '@/components/ui/switch/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export const RuntimeUpdateSettings = () => {
  const maintenance = useWorkspaceStore((state) => state.data?.runtimeMaintenance);
  const act = useWorkspaceStore((state) => state.act);
  const working = useWorkspaceStore((state) => state.working);
  if (!maintenance) return null;
  return (
    <label className="settings-row" htmlFor="automatic-runtime-updates">
      <span>
        <strong>Check runtime updates automatically</strong>
        <span className="quiet block">
          Check installed CLIs daily while Pitchcrew is open. Install updates using each runtime’s
          Update button.
        </span>
        {!maintenance.enabled ? (
          <span className="quiet block">
            Public runtime release checks are disabled in this daemon.
          </span>
        ) : null}
      </span>
      <Switch
        id="automatic-runtime-updates"
        checked={maintenance.automatic}
        disabled={working}
        onCheckedChange={(automatic) => act('/runtimes/updates/preferences', 'PUT', { automatic })}
      />
    </label>
  );
};
