import { ConnectAccountDialog } from '@/ConnectorSettings/components/ConnectAccountDialog.tsx';
import { ConnectedAccounts } from '@/ConnectorSettings/components/ConnectedAccounts.tsx';
import { useConnectorSettings } from '@/ConnectorSettings/hooks/useConnectorSettings.ts';
import type { ConnectorSettingsProps } from '@/ConnectorSettings/types.ts';
import { ExternalLink } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

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
        Connections are read-only. Disconnect removes credentials saved on this device; revoke
        access separately in your provider account. Application claims still come from your profile.
      </p>
      <AnimatePresence>
        {editing ? <ConnectAccountDialog key={editing} {...controller} /> : null}
      </AnimatePresence>
    </section>
  );
}
