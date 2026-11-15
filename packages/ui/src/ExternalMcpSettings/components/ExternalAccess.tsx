import type { ExternalMcpInfo } from '@pitchcrew/core';
import { Switch } from '@pitchcrew/design-system/switch';
import { SettingRow } from '@/SettingsPage/components/SettingRow.tsx';

export const ExternalAccess = ({
  info,
  busy,
  configure,
}: {
  info: ExternalMcpInfo;
  busy: boolean;
  configure: (enabled: boolean, write: boolean) => Promise<void>;
}) => (
  <div className="settings-list settings-preferences">
    <SettingRow
      id="external-mcp-enabled"
      title="Allow external agents"
      description="Read jobs, private Profile notes and saved conversations. Turning this off blocks future calls; work already queued can continue."
    >
      <Switch
        id="external-mcp-enabled"
        aria-labelledby="external-mcp-enabled-label"
        aria-describedby="external-mcp-enabled-description"
        checked={info.enabled}
        disabled={busy}
        onCheckedChange={(enabled) => void configure(enabled, info.write)}
      />
    </SettingRow>
    <SettingRow
      id="external-mcp-write"
      title="Allow changes and crew messages"
      description={
        info.enabled
          ? 'Manage jobs and start crew work, which may spend runtime credits. Approvals stay in Pitchcrew.'
          : 'Enable external agents first. Then allow job changes and crew work, which may spend runtime credits. Approvals stay in Pitchcrew.'
      }
    >
      <Switch
        id="external-mcp-write"
        aria-labelledby="external-mcp-write-label"
        aria-describedby="external-mcp-write-description"
        checked={info.write}
        disabled={busy || !info.enabled}
        onCheckedChange={(write) => void configure(true, write)}
      />
    </SettingRow>
  </div>
);
