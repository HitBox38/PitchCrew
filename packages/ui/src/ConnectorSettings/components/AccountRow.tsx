import { accountPresentation } from '../helpers.ts';
import type { ConnectorStatus } from '@pitchcrew/core';
import type { ConnectedAccountsProps } from '../types.ts';
import { AccountActions } from './AccountActions.tsx';

export const AccountRow = ({
  connector,
  ...model
}: ConnectedAccountsProps & { connector: ConnectorStatus }) => {
  const { name, state, description } = accountPresentation(connector);
  const tone = connector.error ? 'rose' : connector.pending ? 'ochre' : undefined;
  return (
    <article
      className="settings-list-row"
      aria-label={connector.id === 'github' ? 'GitHub account' : 'Google account'}
    >
      <div className="settings-list-main">
        <span
          className="clay-bead"
          data-size="sm"
          data-tone={connector.connected && !connector.error ? 'moss' : tone}
          data-empty={!connector.connected && !tone ? '' : undefined}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 basis-56">
          <div className="settings-list-title">
            <h3>{name}</h3>
            <span className="ui-row-meta">{state}</span>
          </div>
          <p className="quiet wrap-anywhere">{description}</p>
          {connector.connected && connector.id === 'google' ? (
            <p className="quiet">Granted services: {connector.services.join(', ') || 'None'}</p>
          ) : null}
          {connector.connectionMethod === 'cli' ? (
            <p className="quiet">Uses your CLI login. Credentials stay with the CLI.</p>
          ) : null}
        </div>
        <AccountActions {...model} connector={connector} />
      </div>
      {connector.error ? (
        <p className="form-error" role="alert">
          {connector.error}
        </p>
      ) : null}
    </article>
  );
};
