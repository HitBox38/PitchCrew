import { Button } from '@pitchcrew/design-system/button';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { RefreshCw } from 'lucide-react';
import { ExternalAccess } from './components/ExternalAccess.tsx';
import { ConnectApp } from './components/ConnectApp.tsx';
import { VerifyConnection } from './components/VerifyConnection.tsx';
import { useExternalMcp } from './hooks/useExternalMcp.ts';

export const ExternalMcpSettings = () => {
  const { info, error, busy, saved, refresh, configure } = useExternalMcp();
  return (
    <div aria-busy={busy}>
      <SettingsSection
        id="external-mcp-heading"
        title="Local agent apps"
        scope={
          info
            ? `This workspace · ${!info.enabled ? 'Off' : info.write ? 'Job changes + crew' : 'Read-only'}`
            : 'This workspace'
        }
        description="Let an agent in another local app read your workspace or ask your crew to work."
        actions={
          !info || error ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={refresh}>
              <RefreshCw size={14} aria-hidden="true" /> Check again
            </Button>
          ) : undefined
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
            <p className="quiet">
              These permissions apply to local stdio MCP apps. Connect Grok Bot and other remote
              apps in the section below, with separate permissions for each app.
            </p>
            <ol className="external-mcp-steps">
              <li>
                <h4>Choose access</h4>
                <p className="quiet">
                  All configured local apps share this access. Changing either switch requires every
                  local app to reconnect.
                </p>
                <ExternalAccess info={info} busy={busy} configure={configure} />
                {saved ? <output className="quiet">{saved}</output> : null}
              </li>
              <li>
                <h4>Connect your app</h4>
                <ConnectApp info={info} />
              </li>
              <li>
                <h4>Verify a request</h4>
                <VerifyConnection info={info} busy={busy} refresh={refresh} />
              </li>
            </ol>
          </>
        ) : null}
      </SettingsSection>
    </div>
  );
};
