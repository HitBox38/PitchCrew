import type { ConnectorSettingsProps } from '@/ConnectorSettings/types.ts';
import { useState, type FormEvent } from 'react';

export function useConnectorSettings({ data, action, working }: ConnectorSettingsProps) {
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
    close,
    connect,
  };
}
