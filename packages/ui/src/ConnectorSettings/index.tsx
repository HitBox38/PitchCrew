import { ConnectAccountDialog } from '@/ConnectorSettings/components/ConnectAccountDialog.tsx';
import { ConnectedAccounts } from '@/ConnectorSettings/components/ConnectedAccounts.tsx';
import { EffectiveAccess } from '@/ConnectorSettings/components/EffectiveAccess.tsx';
import { useConnectorSettings } from '@/ConnectorSettings/hooks/useConnectorSettings.ts';
import type { ConnectorSettingsProps } from '@/ConnectorSettings/types.ts';
import { ExternalLink } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';

export const ConnectorSettings = (props: ConnectorSettingsProps) => {
  const controller = useConnectorSettings(props);
  const { editing, authorizationUrl, google } = controller;
  return (
    <>
      <SettingsSection
        id="accounts-heading"
        title="Connected services"
        description="Read-only. Disconnect removes credentials saved on this device; revoke access separately with your provider. Application claims still come from your Profile."
      >
        <ConnectedAccounts {...controller} />
        {authorizationUrl && google?.pending ? (
          <output className="settings-callout">
            <span>Finish Google sign-in in your browser. This link expires after ten minutes.</span>
            <a className="button small" href={authorizationUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} aria-hidden="true" /> Continue with Google
            </a>
          </output>
        ) : null}
      </SettingsSection>
      <EffectiveAccess data={props.data} />
      <AnimatePresence>
        {editing ? <ConnectAccountDialog key={editing} {...controller} /> : null}
      </AnimatePresence>
    </>
  );
};
