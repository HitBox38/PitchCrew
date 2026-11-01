import type { Snapshot } from '@pitchcrew/core';
import { decisionOutcome, decisionStage } from '../outcome.ts';
import type { ApprovalRequest } from '../types.ts';

/** The saved result of a past decision as a chip. */
export const DecisionOutcomeChip = ({ request }: { request: ApprovalRequest }) => {
  const outcome = decisionOutcome(request);
  return (
    <span className="decision-status" data-tone={outcome.tone}>
      {outcome.label}
    </span>
  );
};

/** Where the job stands now, kept apart from the decision's outcome. */
export const DecisionStage = ({
  request,
  data,
}: {
  request: ApprovalRequest;
  data: Pick<Snapshot, 'cards'>;
}) => {
  const stage = decisionStage(request, data);
  if (!stage) return null;
  return (
    <span className="decision-stage" data-attention={stage.attention ? '' : undefined}>
      <span className="sr-only">Job stage: </span>
      {stage.label}
    </span>
  );
};
