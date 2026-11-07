import { Switch } from '@pitchcrew/design-system/switch';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useLocation } from '@tanstack/react-router';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { ChevronDown } from 'lucide-react';

export const RuntimeUpdateSettings = () => {
  const maintenance = useWorkspaceStore((state) => state.data?.runtimeMaintenance);
  const act = useWorkspaceStore((state) => state.act);
  const working = useWorkspaceStore((state) => state.working);
  const targeted = useLocation({
    select: (location) => location.hash === 'automatic-runtime-updates',
  });
  const navigation = useLocation({ select: (location) => location.state.settingsFocus });
  if (!maintenance) return null;
  const preference = (
    <label className="settings-row" htmlFor="automatic-runtime-updates">
      <span>
        <strong id="runtime-update-checks-label">Check for updates daily</strong>
        <span id="runtime-update-checks-description" className="quiet block">
          This workspace. Checks run while Pitchcrew is running; updates install only when you
          choose.
        </span>
        {!maintenance.enabled ? (
          <span className="quiet block">Release checks are disabled for this installation.</span>
        ) : null}
      </span>
      <Switch
        id="automatic-runtime-updates"
        aria-labelledby="runtime-update-checks-label"
        aria-describedby="runtime-update-checks-description"
        checked={maintenance.automatic}
        disabled={working || !maintenance.enabled}
        onCheckedChange={(automatic) => act('/runtimes/updates/preferences', 'PUT', { automatic })}
      />
    </label>
  );
  return maintenance.enabled ? (
    preference
  ) : (
    <Collapsible
      key={`${targeted}-${navigation ?? ''}`}
      className="settings-disclosure"
      defaultOpen={targeted}
    >
      <CollapsibleTrigger className="settings-disclosure-trigger">
        <ChevronDown size={14} aria-hidden="true" /> Update checks disabled
      </CollapsibleTrigger>
      <CollapsibleContent>{preference}</CollapsibleContent>
    </Collapsible>
  );
};
