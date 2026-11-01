import { Button } from '@pitchcrew/design-system/button';
import { ExternalLink } from 'lucide-react';
import type { PacketApprovalActionsProps } from '../types.ts';
import type { useSubmissionActions } from '../hooks/useSubmissionActions.ts';
import { PendingPacketDecision } from './PendingPacketDecision.tsx';
import { PacketMoreActions } from './PacketMoreActions.tsx';

export type PacketActionProps = PacketApprovalActionsProps & {
  model: ReturnType<typeof useSubmissionActions>;
  current: boolean;
  uncertain: boolean;
  disabled: boolean;
};

/** One glazed next step for where the packet stands, a clay alternative and the rest in More. */
export const PacketDecisionActions = (props: PacketActionProps) => {
  const { approval, card, action, onOpen, current, uncertain, disabled, model } = props;
  const choosing =
    current && approval.status !== 'pending' && !approval.submission?.requestId && !uncertain;
  const manual = current && approval.submission?.method === 'manual' && !uncertain;
  // After choosing Submit myself, handing over to an agent stays available as the clay option.
  const agent = choosing ? (
    <Button
      variant={approval.submission ? 'outline' : undefined}
      disabled={disabled}
      onClick={() => model.setChooser(true)}
    >
      Let an agent prepare
    </Button>
  ) : null;
  return (
    <div className="decide-actions">
      <PendingPacketDecision {...props} />
      {choosing && !approval.submission ? (
        <>
          {agent}
          <Button variant="outline" disabled={disabled} onClick={() => void model.start('manual')}>
            Submit myself
          </Button>
        </>
      ) : null}
      {approval.submission?.threadId ? (
        <Button onClick={model.continueApplication}>Continue application</Button>
      ) : null}
      {manual ? (
        <>
          <Button
            disabled={disabled}
            onClick={() =>
              void model.perform(() =>
                action(
                  `/approvals/${approval.id}/complete`,
                  'POST',
                  { state: 'submitted' },
                  'Recorded your manual submission',
                ),
              )
            }
          >
            I’ve submitted
          </Button>
          {card.url ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a
                  aria-label="Open application page"
                  href={card.url}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <ExternalLink size={15} />
              Open application page
            </Button>
          ) : (
            <p className="decide-footer-note">Add the employer application link in job details.</p>
          )}
        </>
      ) : null}
      {approval.submission ? agent : null}
      {current && !uncertain ? (
        <PacketMoreActions {...props} />
      ) : (
        <Button variant="outline" onClick={() => onOpen(card.id)}>
          Open job
        </Button>
      )}
    </div>
  );
};
