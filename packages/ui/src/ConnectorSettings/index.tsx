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
        scope="This workspace"
        description={
          props.data.connectors.some((connector) => connector.connected)
            ? 'Read-only. Disconnect removes the saved connection on the computer running Pitchcrew; revoke provider access separately.'
            : 'Connect a service, then choose which agents may read it. Application claims still come from your Profile.'
        }
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
