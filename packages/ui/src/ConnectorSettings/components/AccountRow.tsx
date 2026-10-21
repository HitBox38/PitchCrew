import { accountPresentation } from '../helpers.ts';
import { Link } from 'lucide-react';
import type { ConnectorStatus } from '@pitchcrew/core';
import type { ConnectedAccountsProps } from '../types.ts';
import { AccountActions } from './AccountActions.tsx';
import { AccountAgentAccess } from './AccountAgentAccess.tsx';

export const AccountRow = ({
  connector,
  ...model
}: ConnectedAccountsProps & { connector: ConnectorStatus }) => {
  const { name, state, description } = accountPresentation(connector);
  return (
    <article
      className="account-installation"
      aria-label={connector.id === 'github' ? 'GitHub account' : 'Google account'}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 basis-48 gap-3">
          <Link size={19} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3>{name}</h3>
              <span className={`badge ${connector.connected ? 'success' : ''}`}>{state}</span>
            </div>
            <p className="quiet mt-1 wrap-anywhere">{description}</p>
            {connector.connected && connector.id === 'google' ? (
              <p className="quiet mt-1">
                Granted services: {connector.services.join(', ') || 'None'}
              </p>
            ) : null}
            {connector.connectionMethod === 'cli' ? (
              <p className="quiet mt-1">Uses your CLI login. Credentials stay with the CLI.</p>
            ) : null}
          </div>
        </div>
        <AccountActions {...model} connector={connector} />
      </div>
      {connector.error ? (
        <p className="form-error mt-3" role="alert">
          {connector.error}
        </p>
      ) : null}
      {connector.connected ? (
        <AccountAgentAccess connector={connector} roles={model.data.roles} />
      ) : null}
    </article>
  );
};
