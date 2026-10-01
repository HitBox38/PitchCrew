import { useState, type FormEvent } from 'react';
import { ExternalLink, Link, Unplug } from 'lucide-react';
import type { Snapshot } from '@pitchcrew/core';
import type { Action } from './App.tsx';
import { Modal } from './components.tsx';
import { Button } from './components/ui/button.tsx';
import { Input } from './components/ui/input.tsx';

export function ConnectorSettings({
  data,
  action,
  working,
}: {
  data: Snapshot;
  action: Action;
  working: boolean;
}) {
  const [editing, setEditing] = useState<'github' | 'google' | null>(null);
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [authorizationUrl, setAuthorizationUrl] = useState('');
  const [error, setError] = useState('');
  const google = data.connectors.find((c) => c.id === 'google');
  function close() {
    setEditing(null);
    setToken('');
    setClientId('');
    setClientSecret('');
    setError('');
  }
  async function connect(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (editing === 'github') {
        await action('/connectors/github/connect', 'POST', { token }, 'GitHub connected');
        close();
      } else {
        const result = (await action(
          '/connectors/google/connect',
          'POST',
          google?.configured ? {} : { clientId, clientSecret },
        )) as { authorizationUrl: string };
        setAuthorizationUrl(result.authorizationUrl);
        close();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect account.');
    } finally {
      setToken('');
      setClientSecret('');
    }
  }
  return (
    <section className="connector-settings" aria-label="Connected accounts">
      <h2 className="subheading">Connected accounts</h2>
      <p className="quiet">
        Give your crew source material for research, drafting and interview preparation. Enable each
        service in a role’s settings after connecting.
      </p>
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
      {authorizationUrl && google?.pending ? (
        <output className="connector-authorization">
          <p>Finish Google sign-in in your browser. This link expires after ten minutes.</p>
          <a className="button" href={authorizationUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Continue with Google
          </a>
        </output>
      ) : null}
      <p className="info-note">
        Agents can search and read connected services. Sending mail, editing files and posting to
        GitHub remain unavailable. Disconnect removes local credentials; you can revoke the grant in
        your provider account. Verified packet evidence still comes from Your profile.
      </p>
      {editing ? (
        <Modal
          title={editing === 'github' ? 'Connect GitHub' : 'Connect Google Workspace'}
          onClose={close}
        >
          <form className="form" onSubmit={(e) => void connect(e)}>
            {editing === 'github' ? (
              <>
                <p className="modal-intro">
                  Create a fine-grained personal access token for the repositories your crew should
                  read. Give it read access to Contents and Issues; add Pull requests for PR
                  research. Metadata access is included by GitHub.
                </p>
                <label>
                  GitHub access token
                  <Input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    autoComplete="off"
                    required
                    maxLength={1000}
                  />
                </label>
              </>
            ) : (
              <>
                <p className="modal-intro">
                  Sign in with a Google Desktop OAuth client. Enable Gmail, Drive, Sheets and
                  Calendar APIs in its Google Cloud project, and add your account as a test user if
                  the consent screen is in testing.
                </p>
                {!google?.configured ? (
                  <>
                    <label>
                      Google client ID
                      <Input
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        autoComplete="off"
                        required
                        maxLength={500}
                        placeholder="…apps.googleusercontent.com"
                      />
                    </label>
                    <label>
                      Google client secret
                      <Input
                        type="password"
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        autoComplete="off"
                        maxLength={500}
                      />
                    </label>
                  </>
                ) : null}
                <p className="quiet">
                  The browser will ask for read permissions. You can decline individual services.
                  Connector credentials are stored in your local data directory and never included
                  in agent prompts.
                </p>
              </>
            )}
            {error ? (
              <p role="alert" className="form-error">
                {error}
              </p>
            ) : null}
            <div className="form-footer">
              <Button variant="outline" disabled={working} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={working}>
                {working
                  ? 'Connecting…'
                  : editing === 'github'
                    ? 'Connect GitHub'
                    : 'Start Google sign-in'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
