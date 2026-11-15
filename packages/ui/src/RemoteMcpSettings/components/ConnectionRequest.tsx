import { useState } from 'react';
import type { RemoteMcpRequest } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { Checkbox } from '@pitchcrew/design-system/checkbox';
import { settingsTime } from '@/lib/settings-time.ts';
import { keepRemoteActionFocus } from '../focus.ts';

export const ConnectionRequest = ({
  request,
  disabled,
  decide,
}: {
  request: RemoteMcpRequest;
  disabled: boolean;
  decide: (approved: boolean, write: boolean) => Promise<void>;
}) => {
  const [write, setWrite] = useState(false);
  const canWrite = request.scopes.includes('pitchcrew:write');
  return (
    <article className="remote-mcp-request" aria-labelledby={`remote-request-${request.id}`}>
      <h5 id={`remote-request-${request.id}`}>{request.name}</h5>
      <p className="quiet">
        App-provided name, not verified. Callback: <strong>{request.redirectHost}</strong>.
      </p>
      <p>
        Match this code in the connection page:{' '}
        <code className="remote-mcp-code">{request.code}</code>
      </p>
      <p className="quiet">
        Approve only a connection you started. Expires {settingsTime(request.expiresAt)}.
      </p>
      <p className="quiet">
        Read access includes jobs, private Profile notes and saved conversations. Approvals and
        account settings stay in Pitchcrew.
      </p>
      {canWrite ? (
        <label className="remote-mcp-permission" htmlFor={`remote-write-${request.id}`}>
          <Checkbox
            id={`remote-write-${request.id}`}
            checked={write}
            disabled={disabled}
            onCheckedChange={(checked) => setWrite(checked === true)}
            aria-labelledby={`remote-write-label-${request.id}`}
            aria-describedby={`remote-write-description-${request.id}`}
          />
          <span>
            <span id={`remote-write-label-${request.id}`}>Allow changes and crew messages</span>
            <span id={`remote-write-description-${request.id}`} className="quiet block">
              Can change jobs and start crew work that spends runtime credits.
            </span>
          </span>
        </label>
      ) : (
        <p className="quiet">This app requested read-only access.</p>
      )}
      <div className="remote-mcp-actions">
        <Button
          size="sm"
          disabled={disabled}
          onClick={(event) =>
            void keepRemoteActionFocus(event.currentTarget, 'remote-request-heading', () =>
              decide(true, canWrite && write),
            )
          }
        >
          {canWrite && write ? 'Approve with changes' : 'Approve read-only'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={(event) =>
            void keepRemoteActionFocus(event.currentTarget, 'remote-request-heading', () =>
              decide(false, false),
            )
          }
        >
          Reject
        </Button>
      </div>
    </article>
  );
};
