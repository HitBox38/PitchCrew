import { Button } from '@pitchcrew/design-system/button';
import { Check } from 'lucide-react';
import type { PacketActionProps } from './PacketDecisionActions.tsx';

/** Approve the exact packet, or send it back to the Writer with a drafted request. */
export const PendingPacketDecision = ({
  approval,
  action,
  current,
  disabled,
  model,
}: PacketActionProps) =>
  current && approval.status === 'pending' ? (
    <>
      <Button
        disabled={disabled}
        onClick={() =>
          void model.perform(() =>
            action(`/approvals/${approval.id}/decide`, 'POST', { approved: true }),
          )
        }
      >
        <Check size={16} />
        Approve packet
      </Button>
      <Button variant="outline" disabled={disabled} onClick={() => void model.askWriter()}>
        Request changes
      </Button>
    </>
  ) : null;
