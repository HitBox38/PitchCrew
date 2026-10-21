import { Button } from '@/components/ui/button/components/Button.tsx';
import { ExternalLink } from 'lucide-react';
import type { PacketApprovalActionsProps } from '../types.ts';
import type { useSubmissionActions } from '../hooks/useSubmissionActions.ts';
type Props = PacketApprovalActionsProps & {
  model: ReturnType<typeof useSubmissionActions>;
  current: boolean;
  uncertain: boolean;
  disabled: boolean;
};
import { PendingPacketDecision } from './PendingPacketDecision.tsx';
export const PacketDecisionActions = (props: Props) => {
  const { approval, card, action, onOpen, current, uncertain, disabled, model } = props;
  return (
    <div className="mail-decision-actions">
      <Button variant="ghost" onClick={() => onOpen(card.id)}>
        Open job
      </Button>
      <PendingPacketDecision {...props} />
      {current && approval.status !== 'pending' && !approval.submission?.requestId && !uncertain ? (
        <>
          {!approval.submission ? (
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => void model.start('manual')}
            >
              Submit myself
            </Button>
          ) : null}
          <Button disabled={disabled} onClick={() => model.setChooser(true)}>
            Let an agent submit
          </Button>
        </>
      ) : null}
      {approval.submission?.threadId ? (
        <Button onClick={model.continueApplication}>Continue application</Button>
      ) : null}
      {current && approval.submission?.method === 'manual' && !uncertain ? (
        <>
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
            <p className="quiet">Add the employer application link in job details.</p>
          )}
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
        </>
      ) : null}
      {current && !uncertain ? (
        <Button variant="ghost" disabled={disabled} onClick={() => model.setConfirmWithdraw(true)}>
          Not applying
        </Button>
      ) : null}
      {current && !uncertain ? (
        <Button variant="ghost" disabled={disabled} onClick={() => void model.askWriter()}>
          Ask Writer for changes
        </Button>
      ) : null}
    </div>
  );
};
