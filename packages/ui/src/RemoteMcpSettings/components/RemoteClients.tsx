import type { RemoteMcpClient } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { settingsTime } from '@/lib/settings-time.ts';
import { keepRemoteActionFocus } from '../focus.ts';

export const RemoteClients = ({
  clients,
  disabled,
  disconnect,
  feedback,
}: {
  clients: RemoteMcpClient[];
  disabled: boolean;
  disconnect: (id: string) => Promise<void>;
  feedback: string;
}) => (
  <div className="remote-mcp-clients">
    <h4 id="remote-clients-heading" tabIndex={-1}>
      Authorized apps
    </h4>
    <p className="quiet">
      Look for Last successful request to confirm an app has used this connection.
    </p>
    {feedback ? <output className="quiet">{feedback}</output> : null}
    {clients.length ? (
      clients.map((client) => (
        <article className="remote-mcp-client" key={client.id}>
          <div>
            <h5>{client.name}</h5>
            <p className="quiet">
              {client.write ? 'Job changes and crew messages' : 'Read-only'} · Authorized{' '}
              {settingsTime(client.createdAt)}
            </p>
            <p className="quiet">
              {client.lastUsedAt
                ? `Last successful request ${settingsTime(client.lastUsedAt)}`
                : 'Authorized, no requests yet'}
            </p>
            <p className="quiet">
              Until the connection stops, at most until {settingsTime(client.expiresAt)}.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label={`Disconnect ${client.name}`}
            onClick={(event) =>
              void keepRemoteActionFocus(event.currentTarget, 'remote-clients-heading', () =>
                disconnect(client.id),
              )
            }
          >
            Disconnect
          </Button>
        </article>
      ))
    ) : (
      <p className="quiet">Apps appear here after they finish connecting.</p>
    )}
  </div>
);
