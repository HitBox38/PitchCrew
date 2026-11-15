import type { RemoteMcpInfo } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { StopRemoteConnection } from './StopRemoteConnection.tsx';

export const RemoteConnection = ({
  info,
  disabled,
  start,
  stop,
  feedback,
}: {
  info: RemoteMcpInfo;
  disabled: boolean;
  start: () => void;
  stop: () => Promise<void>;
  feedback: string;
}) => (
  <div className="remote-mcp-connection">
    {info.error ? (
      <p className="form-error" role="alert">
        {info.error}
      </p>
    ) : null}
    {info.state === 'starting' ? (
      <output className="settings-callout">Creating your temporary address…</output>
    ) : null}
    {info.state === 'ready' && info.url ? (
      <SourceBlock label="Remote MCP address" value={info.url} copyLabel="Copy address" />
    ) : null}
    {!info.tunnelAvailable && info.state !== 'ready' ? (
      <p className="quiet">
        Install{' '}
        <a
          href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
          target="_blank"
          rel="noreferrer"
        >
          cloudflared
        </a>{' '}
        on the computer running Pitchcrew, then check status. No Cloudflare account or domain is
        needed for a temporary address.
      </p>
    ) : null}
    <p className="quiet">
      Keep Pitchcrew and this computer running. The temporary address changes after stopping or
      restarting; reconnect your apps. Authorized data passes through Cloudflare and the remote app,
      and temporary connections have no uptime guarantee.
    </p>
    <div className="remote-mcp-actions">
      {info.state === 'starting' || info.state === 'ready' ? (
        <StopRemoteConnection
          apps={info.clients.length}
          requests={info.requests.length}
          disabled={disabled}
          stop={stop}
        />
      ) : (
        <Button size="sm" disabled={disabled || !info.tunnelAvailable} onClick={start}>
          {info.state === 'failed' ? 'Start a new address' : 'Start temporary connection'}
        </Button>
      )}
    </div>
    {feedback ? <output className="quiet">{feedback}</output> : null}
    <p className="quiet">
      Stopping disconnects every remote app. Work already queued can continue.
    </p>
  </div>
);
