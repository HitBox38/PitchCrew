import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ConnectedAccountsProps } from '@/ConnectorSettings/types.ts';
import { Link, Unplug } from 'lucide-react';

export function ConnectedAccounts({
  data,
  working,
  action,
  setError,
  setEditing,
}: ConnectedAccountsProps) {
  return (
    <div className="runtime-list">
      {data.connectors.map((connector) => (
        <div className="runtime-row connector-row" key={connector.id}>
          <Link size={18} aria-hidden="true" />
          <div>
            <strong>{connector.id === 'github' ? 'GitHub' : 'Google Workspace'}</strong>
            <p>
              {connector.connected
                ? connector.account
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
          </div>
          <span className={`badge ${connector.connected ? 'success' : ''}`}>
            {connector.connected ? 'Connected' : 'Disconnected'}
          </span>
          {connector.connected || connector.pending ? (
            <Button
              variant="outline"
              disabled={working}
              onClick={() =>
                void action(
                  `/connectors/${connector.id}/disconnect`,
                  'POST',
                  {},
                  'Account disconnected',
                ).catch(() => {})
              }
            >
              <Unplug size={14} /> {connector.pending ? 'Cancel sign-in' : 'Disconnect'}
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={working}
              onClick={() => {
                setError('');
                setEditing(connector.id);
              }}
            >
              Connect
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
