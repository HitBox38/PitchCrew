import type { Snapshot } from '@pitchcrew/core';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { serviceAccess } from '../helpers.ts';
import { AccountAgentAccess } from './AccountAgentAccess.tsx';

/** Which agents can read each granted service, and why a capability gives no access. */
export const EffectiveAccess = ({ data }: { data: Snapshot }) => (
  <SettingsSection
    id="agent-access-heading"
    title="Effective agent access"
    description="Connecting an account grants nothing by itself. Each agent’s connected-service capabilities decide what it can read."
  >
    <div className="settings-list">
      {data.connectors.map((connector) => (
        <article
          key={connector.id}
          className="settings-list-row"
          aria-label={connector.id === 'github' ? 'GitHub access' : 'Google access'}
        >
          <h3>{connector.id === 'github' ? 'GitHub' : 'Google Workspace'}</h3>
          {connector.connected ? (
            <>
              <dl className="settings-access">
                {serviceAccess(data.roles, connector).map((row) => (
                  <div key={row.service} data-granted={row.granted || undefined}>
                    <dt>{row.label}</dt>
                    <dd>{row.note}</dd>
                  </div>
                ))}
              </dl>
              <AccountAgentAccess connector={connector} roles={data.roles} />
            </>
          ) : (
            <p className="quiet">
              Connect {connector.id === 'github' ? 'GitHub' : 'Google'} to give agents read access.
            </p>
          )}
        </article>
      ))}
    </div>
  </SettingsSection>
);
