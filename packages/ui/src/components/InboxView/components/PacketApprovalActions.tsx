import { PacketDecisionActions } from './PacketDecisionActions.tsx';
import { useSubmissionActions } from '../hooks/useSubmissionActions.ts';
import { SubmissionChooser } from './SubmissionChooser.tsx';
import { WithdrawConfirmation } from './WithdrawConfirmation.tsx';
import { packetConsequence, packetNeedsAction } from '../helpers.ts';
import type { PacketApprovalActionsProps } from '../types.ts';

/** The packet's pinned decision bar: its actions on the left, their one consequence on the right. */
export const PacketApprovalActions = (props: PacketApprovalActionsProps) => {
  const { approval, card, data, action } = props;
  const model = useSubmissionActions(props);
  const active =
    data.runs.some((run) => run.cardId === card.id && run.status === 'running') || !!card.owner;
  const uncertain = card.submissionAttempts?.some((attempt) => attempt.status === 'uncertain');
  const current = packetNeedsAction(approval, data.cards);
  const disabled = props.working || model.busy || active;
  const consequence = packetConsequence(approval, card.company, current);
  return (
    <footer className="decide-footer" aria-label="Packet decision">
      {model.error ? (
        <p className="form-error" role="alert">
          {model.error}
        </p>
      ) : null}
      {active ? (
        <p className="decide-footer-note">
          Application work is active. Open the conversation to stop preparation or take control.
        </p>
      ) : null}
      {uncertain ? (
        <p className="decide-footer-note text-ochre">
          Verify the submission outcome in the conversation or job details before doing anything
          else.
        </p>
      ) : null}
      {model.busy ? (
        <output className="decide-footer-note">
          Saving your choice and preparing the reviewed files…
        </output>
      ) : null}
      {/* The chooser carries its own start, manual and cancel actions. */}
      {model.chooser ? (
        <SubmissionChooser model={model} data={data} />
      ) : (
        <div className="decide-footer-bar">
          <PacketDecisionActions
            {...props}
            model={model}
            current={current}
            uncertain={!!uncertain}
            disabled={disabled}
          />
          {consequence ? <p className="decide-consequence">{consequence}</p> : null}
        </div>
      )}
      <WithdrawConfirmation
        open={model.confirmWithdraw}
        busy={disabled}
        close={() => model.setConfirmWithdraw(false)}
        confirm={() =>
          void model.perform(async () => {
            await action(
              `/approvals/${approval.id}/complete`,
              'POST',
              { state: 'withdrawn' },
              'Marked withdrawn',
            );
            model.setConfirmWithdraw(false);
          })
        }
      />
    </footer>
  );
};
