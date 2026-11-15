import { Button } from '@pitchcrew/design-system/button';
import { RefreshCw } from 'lucide-react';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { RemoteSetup } from './components/RemoteSetup.tsx';
import { useRemoteMcp } from './hooks/useRemoteMcp.ts';
import './styles.css';

const stateLabel = {
  off: 'Off',
  starting: 'Starting',
  ready: 'Address ready',
  failed: 'Connection failed',
};

export const RemoteMcpSettings = () => {
  const model = useRemoteMcp();
  const { info, error, loading, busy, refresh } = model;
  return (
    <SettingsSection
      id="remote-mcp-heading"
      title="Grok Bot and remote apps"
      scope={info ? `This workspace · ${stateLabel[info.state]}` : 'This workspace'}
      count={
        info?.requests.length ? (
          <span className="ui-chip" data-tone="ochre">
            {info.requests.length} {info.requests.length === 1 ? 'request' : 'requests'} waiting
          </span>
        ) : undefined
      }
      description="A temporary public connection. Approve each app here in Pitchcrew."
      className="remote-mcp-settings"
      actions={
        <Button
          id="remote-mcp-check"
          variant="ghost"
          size="sm"
          disabled={loading || !!busy}
          onClick={refresh}
        >
          <RefreshCw size={14} aria-hidden="true" /> Check status
        </Button>
      }
    >
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {!info && !error ? <p className="quiet">Checking remote connections…</p> : null}
      {info ? <RemoteSetup info={info} model={model} /> : null}
    </SettingsSection>
  );
};
