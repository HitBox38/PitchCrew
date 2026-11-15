import type { RemoteMcpRequest } from '@pitchcrew/core';
import { ConnectionRequest } from './ConnectionRequest.tsx';

export const ConnectionRequests = ({
  requests,
  disabled,
  decide,
  feedback,
  heading = 'Connection requests',
}: {
  requests: RemoteMcpRequest[];
  disabled: boolean;
  decide: (id: string, approved: boolean, write: boolean) => Promise<void>;
  feedback: string;
  heading?: string;
}) => (
  <div className="remote-mcp-requests">
    <h4 id="remote-request-heading" tabIndex={-1}>
      {heading}
      {requests.length ? ` (${requests.length})` : ''}
    </h4>
    {feedback ? <output className="quiet">{feedback}</output> : null}
    {requests.length ? (
      requests.map((request) => (
        <ConnectionRequest
          key={request.id}
          request={request}
          disabled={disabled}
          decide={(approved, write) => decide(request.id, approved, write)}
        />
      ))
    ) : (
      <p className="quiet">
        Requests appear here after an app starts connecting. Match its code before approving.
      </p>
    )}
  </div>
);
