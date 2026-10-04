import { AccountActions } from '@/ConnectorSettings/components/AccountActions.tsx';
import type { ConnectedAccountsProps } from '@/ConnectorSettings/types.ts';
import { Link } from 'lucide-react';

export function ConnectedAccounts({ data, working, action, open }: ConnectedAccountsProps) {
  return (
    <div className="runtime-list">
      {data.connectors.map((connector) => (
        <div className="runtime-row connector-row" key={connector.id}>
          <Link size={18} aria-hidden="true" />
          <div>
            <strong>{connector.id === 'github' ? 'GitHub' : 'Google'}</strong>
            <p>
              {connector.connected
                ? `Connected as ${connector.account}`
                : connector.pending
                  ? 'Waiting for sign-in…'
                  : 'No account connected'}
            </p>
            <small>
              {connector.id === 'github'
                ? 'Repositories, files, profiles and issues'
                : 'Gmail, Drive, Docs, Sheets and Calendar'}{' '}
              · Read access
            </small>
            {connector.error ? (
              <p className="form-error" role="alert">
                {connector.error}
              </p>
            ) : null}
            {connector.connected && connector.id === 'google' ? (
              <p className="quiet">Granted: {connector.services.join(', ')}</p>
            ) : null}
            {connector.connected && connector.connectionMethod === 'cli' ? (
              <p className="quiet">
                Uses your {connector.id === 'github' ? 'GitHub' : 'Google Workspace'} CLI login.
                Credentials stay with the CLI.
              </p>
            ) : null}
          </div>
          <span className={`badge ${connector.connected ? 'success' : ''}`}>
            {connector.connected ? 'Connected' : connector.pending ? 'Signing in…' : 'Disconnected'}
          </span>
          <AccountActions connector={connector} working={working} action={action} open={open} />
        </div>
      ))}
    </div>
  );
}
