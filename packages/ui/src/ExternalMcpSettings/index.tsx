import { Button } from '@/components/ui/button/components/Button.tsx';
import { Switch } from '@/components/ui/switch/index.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { RefreshCw } from 'lucide-react';
import { useExternalMcp } from './hooks/useExternalMcp.ts';

export const ExternalMcpSettings = () => {
  const { info, error, busy, refresh, configure } = useExternalMcp();
  return (
    <section className="settings-section" aria-labelledby="external-mcp-heading" aria-busy={busy}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="external-mcp-heading">External agents</h2>
        <Button className="button" disabled={busy} onClick={refresh}>
          <RefreshCw size={15} /> Check again
        </Button>
      </div>
      <p className="quiet">
        Connect desktop agent apps through local MCP. Enabled clients can read your board, Profile
        and conversations.
      </p>
      {error ? (
        <p className="info-note" role="alert">
          {error}
        </p>
      ) : null}
      {!info && !error ? <p className="info-note">Checking external agent access.</p> : null}
      {info ? (
        <>
          <label className="settings-row" htmlFor="external-mcp-enabled">
            <span>
              <strong id="external-mcp-enabled-label">Allow external agents</strong>
              <span id="external-mcp-enabled-description" className="quiet block">
                Disabling revokes access for every connected app.
              </span>
            </span>
            <Switch
              id="external-mcp-enabled"
              aria-labelledby="external-mcp-enabled-label"
              aria-describedby="external-mcp-enabled-description"
              checked={info.enabled}
              disabled={busy}
              onCheckedChange={(enabled) => void configure(enabled, info.write)}
            />
          </label>
          <label className="settings-row" htmlFor="external-mcp-write">
            <span>
              <strong id="external-mcp-write-label">Allow changes and crew messages</strong>
              <span id="external-mcp-write-description" className="quiet block">
                Manage jobs and start crew work, which may spend runtime credits. Approvals stay in
                Pitchcrew.
              </span>
            </span>
            <Switch
              id="external-mcp-write"
              aria-labelledby="external-mcp-write-label"
              aria-describedby="external-mcp-write-description"
              checked={info.write}
              disabled={busy || !info.enabled}
              onCheckedChange={(write) => void configure(true, write)}
            />
          </label>
          {info.enabled ? (
            <>
              <p className="info-note">
                Copy this configuration into a trusted desktop agent app. Reconnect clients after
                enabling access or changing permissions. Keep Pitchcrew running.
              </p>
              <SourceBlock
                label="Pitchcrew MCP configuration"
                value={JSON.stringify(info.configuration, null, 2)}
              />
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
};
