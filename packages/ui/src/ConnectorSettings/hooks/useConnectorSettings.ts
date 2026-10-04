import type { ConnectorSettingsProps } from '@/ConnectorSettings/types.ts';
import { useState, type FormEvent } from 'react';

export function useConnectorSettings({ data, action, working }: ConnectorSettingsProps) {
  const [editing, setEditing] = useState<'github' | 'google' | null>(null);
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [authorizationUrl, setAuthorizationUrl] = useState('');
  const [error, setError] = useState('');
  const [customGoogle, setCustomGoogle] = useState(false);
  const google = data.connectors.find((c) => c.id === 'google');
  const github = data.connectors.find((c) => c.id === 'github');
  function close() {
    setEditing(null);
    setToken('');
    setClientId('');
    setClientSecret('');
    setError('');
    setCustomGoogle(false);
  }
  async function prepareGoogle(custom = false) {
    setAuthorizationUrl('');
    const result = (await action(
      '/connectors/google/connect',
      'POST',
      custom ? { clientId, clientSecret } : {},
    )) as { authorizationUrl: string };
    setAuthorizationUrl(result.authorizationUrl);
    close();
  }
  async function open(provider: 'github' | 'google', advanced = false) {
    setError('');
    setCustomGoogle(advanced);
    if (provider !== 'google' || advanced || !google?.configured) {
      setEditing(provider);
      return;
    }
    try {
      await prepareGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start Google sign-in.');
      setEditing('google');
    }
  }
  async function connect(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (editing === 'github') {
        await action('/connectors/github/connect', 'POST', { token }, 'GitHub connected');
        close();
      } else {
        await prepareGoogle(customGoogle);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect account.');
    } finally {
      setToken('');
      setClientSecret('');
    }
  }
  async function connectGithubCli() {
    setError('');
    try {
      await action('/connectors/github/connect', 'POST', { mode: 'cli' }, 'GitHub connected');
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect GitHub CLI.');
    }
  }
  return {
    data,
    action,
    working,
    editing,
    setEditing,
    token,
    setToken,
    clientId,
    setClientId,
    clientSecret,
    setClientSecret,
    authorizationUrl,
    error,
    setError,
    google,
    customGoogle,
    setCustomGoogle,
    open,
    github,
    connectGithubCli,
    close,
    connect,
  };
}
