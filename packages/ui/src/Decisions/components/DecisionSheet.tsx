import type { Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { Decision } from '@/ClayInterface/signals.ts';
import { DecisionBody } from './DecisionBody.tsx';
import { DecisionFooter } from './DecisionFooter.tsx';
import { DecisionHeading } from './DecisionHeading.tsx';
import { DecisionRail } from './DecisionRail.tsx';
import { QuestionSheet } from './QuestionSheet.tsx';

type DecisionSheetProps = {
  decision: Decision;
  data: Snapshot;
  action: Action;
  working: boolean;
  openCard: (id: string, section?: 'application') => void;
};

/** One raised sheet: what is being decided, its evidence, then what follows and the job so far. */
export const DecisionSheet = (props: DecisionSheetProps) => {
  const { decision, data } = props;
  const card = data.cards.find((item) => item.id === decision.cardId);
  const packet = data.approvals.find((item) => item.id === decision.id);
  const browser = data.computerApprovals.find((item) => item.id === decision.id);
  const question = data.userInputs?.find((item) => item.id === decision.id);
  if (decision.kind === 'question' && question)
    return <QuestionSheet {...props} question={question} card={card} />;
  return (
    <article className="decide-sheet" data-kind={decision.kind} aria-label="Decision">
      <div className="decide-sheet-scroll">
        <div className="decide-main">
          <DecisionHeading {...props} card={card} packet={packet} browser={browser} />
          <DecisionBody {...props} card={card} packet={packet} browser={browser} />
        </div>
        <DecisionRail decision={decision} data={data} card={card} packet={packet} />
      </div>
      <DecisionFooter {...props} card={card} packet={packet} browser={browser} />
    </article>
  );
};
