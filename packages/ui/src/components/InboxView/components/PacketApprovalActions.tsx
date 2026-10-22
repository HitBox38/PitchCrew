import { PacketDecisionActions } from './PacketDecisionActions.tsx';
import { useSubmissionActions } from '../hooks/useSubmissionActions.ts';
import { SubmissionChooser } from './SubmissionChooser.tsx';
import { WithdrawConfirmation } from './WithdrawConfirmation.tsx';
import { packetNeedsAction } from '../helpers.ts';
import type { PacketApprovalActionsProps } from '../types.ts';
export const PacketApprovalActions = (props: PacketApprovalActionsProps) => {
  const { approval, card, data, action } = props;
  const model = useSubmissionActions(props);
  const active =
    data.runs.some((run) => run.cardId === card.id && run.status === 'running') || !!card.owner;
  const uncertain = card.submissionAttempts?.some((attempt) => attempt.status === 'uncertain');
  const current = packetNeedsAction(approval, data.cards);
  const disabled = props.working || model.busy || active;
  return (
    <div className="mail-decision-footer">
      {model.error ? (
        <p className="form-error" role="alert">
          {model.error}
        </p>
      ) : null}
      {model.chooser ? <SubmissionChooser model={model} data={data} /> : null}
      <PacketDecisionActions
        {...props}
        model={model}
        current={current}
        uncertain={!!uncertain}
        disabled={disabled}
      />
      {active ? (
        <p className="quiet">
          Application work is active. Open the conversation to stop preparation or take control.
        </p>
      ) : null}
      {uncertain ? (
        <p className="text-ochre">
          Verify the submission outcome in the conversation or job details before doing anything
          else.
        </p>
      ) : null}
      {model.busy ? <output>Saving your choice and preparing the reviewed files…</output> : null}
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
    </div>
  );
};
