import { ConnectAccountDialog } from '@/ConnectorSettings/components/ConnectAccountDialog.tsx';
import { ConnectedAccounts } from '@/ConnectorSettings/components/ConnectedAccounts.tsx';
import { useConnectorSettings } from '@/ConnectorSettings/hooks/useConnectorSettings.ts';
import type { ConnectorSettingsProps } from '@/ConnectorSettings/types.ts';
import { ExternalLink } from 'lucide-react';

export function ConnectorSettings(props: ConnectorSettingsProps) {
  const controller = useConnectorSettings(props);
  const { editing, authorizationUrl, google } = controller;
  return (
    <section className="connector-settings" aria-label="Connected accounts">
      <h2 className="subheading">Connected accounts</h2>
      <p className="quiet">
        Give your crew source material for research, drafting and interview preparation. Enable each
        service in a role’s settings after connecting.
      </p>
      <ConnectedAccounts {...controller} />
      {authorizationUrl && google?.pending ? (
        <output className="connector-authorization">
          <p>Finish Google sign-in in your browser. This link expires after ten minutes.</p>
          <a className="button" href={authorizationUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Continue with Google
          </a>
        </output>
      ) : null}
      <p className="info-note">
        Agents can search and read connected services. Sending mail, editing files and posting to
        GitHub remain unavailable. Disconnect removes local credentials; you can revoke the grant in
        your provider account. Verified packet evidence still comes from Your profile.
      </p>
      {editing ? <ConnectAccountDialog {...controller} /> : null}
    </section>
  );
}
