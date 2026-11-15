import type { RemoteMcpInfo } from '@pitchcrew/core';
import type { useRemoteMcp } from '../hooks/useRemoteMcp.ts';
import { RemoteConnection } from './RemoteConnection.tsx';
import { GrokHandoff } from './GrokHandoff.tsx';
import { ConnectionRequests } from './ConnectionRequests.tsx';
import { RemoteClients } from './RemoteClients.tsx';

export const RemoteSetup = ({
  info,
  model,
}: {
  info: RemoteMcpInfo;
  model: ReturnType<typeof useRemoteMcp>;
}) => {
  const { saved, savedFor, disabled, change } = model;
  const requestFeedback = savedFor.startsWith('/requests/') ? saved : '';
  const requestsFirst = info.requests.length > 0 || !!requestFeedback;
  const requests = (
    <ConnectionRequests
      requests={info.requests}
      disabled={disabled}
      heading={requestsFirst ? 'Connection requests' : 'Approve the matching request'}
      feedback={requestFeedback}
      decide={(id, approved, write) =>
        change(
          `/requests/${id}/decision`,
          'POST',
          { approved, write },
          approved
            ? 'Approved. Waiting for the app to finish connecting; it will appear below.'
            : 'Connection rejected.',
        )
      }
    />
  );
  return (
    <>
      {requestsFirst ? requests : null}
      <ol className="external-mcp-steps remote-mcp-steps">
        <li>
          <h4>Start a temporary address</h4>
          <RemoteConnection
            info={info}
            disabled={disabled}
            feedback={savedFor === '/stop' ? saved : ''}
            start={() => void change('/start', 'POST', {}, '')}
            stop={() =>
              change(
                '/stop',
                'POST',
                {},
                'Remote connection stopped. All remote apps disconnected. Queued work may continue.',
              )
            }
          />
        </li>
        <li>
          <h4>Send Grok Bot the message</h4>
          <GrokHandoff info={info} />
        </li>
        <li>
          {requestsFirst ? (
            <>
              <h4>Approve the matching request</h4>
              <p className="quiet">
                The request or your decision is shown above. Match the code on the connection page
                before approving.
              </p>
            </>
          ) : (
            requests
          )}
        </li>
        <li>
          <RemoteClients
            clients={info.clients}
            disabled={disabled}
            feedback={savedFor.startsWith('/clients/') ? saved : ''}
            disconnect={(id) =>
              change(
                `/clients/${id}`,
                'DELETE',
                undefined,
                'App disconnected. New requests are blocked; queued work may continue.',
              )
            }
          />
        </li>
      </ol>
    </>
  );
};
