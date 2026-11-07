import type { Snapshot } from '@pitchcrew/core';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { serviceAccess } from '../helpers.ts';
import { AccountAgentAccess } from './AccountAgentAccess.tsx';

/** Which agents can read each granted service, and why a capability gives no access. */
export const EffectiveAccess = ({ data }: { data: Snapshot }) => {
  const connected = data.connectors.filter((connector) => connector.connected);
  return (
    <SettingsSection
      id="agent-access-heading"
      title="Effective agent access"
      scope="This workspace"
      description={
        connected.length
          ? 'Connecting an account grants nothing by itself. Each agent’s granted tools decide what it can read.'
          : undefined
      }
    >
      {connected.length ? (
        <div className="settings-list">
          {connected.map((connector) => (
            <article
              key={connector.id}
              className="settings-list-row"
              aria-label={connector.id === 'github' ? 'GitHub access' : 'Google access'}
            >
              <h4>{connector.id === 'github' ? 'GitHub' : 'Google Workspace'}</h4>
              <dl className="settings-access">
                {serviceAccess(data.roles, connector).map((row) => (
                  <div key={row.service} data-granted={row.granted || undefined}>
                    <dt>{row.label}</dt>
                    <dd>{row.note}</dd>
                  </div>
                ))}
              </dl>
              <AccountAgentAccess connector={connector} roles={data.roles} />
            </article>
          ))}
        </div>
      ) : (
        <p className="quiet">
          No connected accounts. Your crew has no access to external services.
        </p>
      )}
    </SettingsSection>
  );
};
