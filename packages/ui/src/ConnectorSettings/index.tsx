import { ConnectAccountDialog } from '@/ConnectorSettings/components/ConnectAccountDialog.tsx';
import { ConnectedAccounts } from '@/ConnectorSettings/components/ConnectedAccounts.tsx';
import { useConnectorSettings } from '@/ConnectorSettings/hooks/useConnectorSettings.ts';
import type { ConnectorSettingsProps } from '@/ConnectorSettings/types.ts';
import { ExternalLink } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { SettingsIntro } from '@/SettingsPage/components/SettingsIntro.tsx';

export const ConnectorSettings = (props: ConnectorSettingsProps) => {
  const controller = useConnectorSettings(props);
  const { editing, authorizationUrl, google } = controller;
  return (
    <section className="connector-settings" aria-label="Connected accounts">
      <SettingsIntro
        id="accounts-heading"
        title="Accounts"
        description="Connect source material for research, drafting and interview preparation. Choose which agents can read each connected service."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3>Connected accounts</h3>
        <span className="quiet">Read-only access</span>
      </div>
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
};
