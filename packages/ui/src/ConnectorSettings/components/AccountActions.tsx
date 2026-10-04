import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ConnectedAccountsProps } from '@/ConnectorSettings/types.ts';
import type { ConnectorStatus } from '@pitchcrew/core';
import { Unplug } from 'lucide-react';

type Props = Pick<ConnectedAccountsProps, 'working' | 'action' | 'open'> & {
  connector: ConnectorStatus;
};

export function AccountActions({ connector, working, action, open }: Props) {
  if (connector.connected || connector.pending)
    return (
      <Button
        className="button max-compact:col-start-3 max-compact:row-start-2"
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
    );
  return (
    <div className="flex flex-col items-end gap-1 max-compact:col-start-3 max-compact:row-start-2">
      <Button className="button" disabled={working} onClick={() => void open(connector.id)}>
        {connector.id === 'google' ? 'Connect Google' : 'Connect'}
      </Button>
      {connector.id === 'google' ? (
        <Button
          variant="link"
          size="sm"
          disabled={working}
          onClick={() => void open('google', true)}
        >
          Advanced setup
        </Button>
      ) : null}
    </div>
  );
}
