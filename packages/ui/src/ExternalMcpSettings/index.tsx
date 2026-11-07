import { Button } from '@pitchcrew/design-system/button';
import { Switch } from '@pitchcrew/design-system/switch';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { SettingRow } from '@/SettingsPage/components/SettingRow.tsx';
import { RefreshCw } from 'lucide-react';
import { useExternalMcp } from './hooks/useExternalMcp.ts';

export const ExternalMcpSettings = () => {
  const { info, error, busy, refresh, configure } = useExternalMcp();
  return (
    <div aria-busy={busy}>
      <SettingsSection
        id="external-mcp-heading"
        title="External agents"
        scope="This workspace"
        description="Connect desktop agent apps through local MCP. Enabled clients can read your board, Profile and conversations."
        actions={
          <Button variant="ghost" size="sm" disabled={busy} onClick={refresh}>
            <RefreshCw size={14} aria-hidden="true" /> Check again
          </Button>
        }
      >
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {!info && !error ? <p className="quiet">Checking external agent access…</p> : null}
        {info ? (
          <>
            <div className="settings-list settings-preferences">
              <SettingRow
                id="external-mcp-enabled"
                title="Allow external agents"
                description="Turning this off revokes access for every connected app."
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
            {info.enabled ? (
              <div className="settings-config">
                <p className="quiet">
                  Copy this into a trusted desktop agent app, then reconnect it after changing
                  access. It contains no credential. Keep Pitchcrew running.
                </p>
                <SourceBlock
                  label="Pitchcrew MCP configuration"
                  value={JSON.stringify(info.configuration, null, 2)}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </SettingsSection>
    </div>
  );
};
