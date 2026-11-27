import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { DecisionBody } from '@/Decisions/components/DecisionBody.tsx';
import { DecisionFooter } from '@/Decisions/components/DecisionFooter.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { snapshotStepFacts } from '@/lib/job-step.ts';
import { asDecision } from '../../../helpers.ts';
import { deskRecords } from '../../../records.ts';
import { useDeskTools } from '../../../hooks/useDeskTools.ts';
import type { BodyProps } from '../../../types.ts';
import { OpenHeader } from './OpenHeader.tsx';
import { WaitingOn } from './WaitingOn.tsx';

/**
 * A packet or a brief, decided with Decisions' own body and footer, its evidence between the ask
 * and who asked. A packet to approve shows that evidence open (with the same consented detector
 * Check as Decisions); at later stages the packet stays under Show packet. A brief shows its
 * read-only preview and opens job details to confirm, where the full checks run; confirmed there,
 * it leaves a record line as a desk decision does.
 */
export const DecisionsBody = ({ item, data }: BodyProps) => {
  const { act, openCard } = useDeskTools();
  const working = useWorkspaceStore((state) => state.working);
  const [shown, setShown] = useState(false);
  const decision = asDecision(item);
  const card = data.cards.find((entry) => entry.id === item.cardId);
  const packet =
    item.kind === 'packet' ? data.approvals.find((entry) => entry.id === item.entityId) : undefined;
  const parts = { decision, data, card, packet, browser: undefined };
  const evidence = <DecisionBody {...parts} />;
  const confirmed = (fresh: typeof data) => {
    const job = fresh.cards.find((entry) => entry.id === item.cardId);
    return !!job && snapshotStepFacts(job, fresh.approvals).briefConfirmed;
  };
  const open: typeof openCard = (id, section) => {
    if (item.kind === 'brief') deskRecords.watch({ item, data }, confirmed);
    openCard(id, section);
  };
  return (
    <>
      <OpenHeader item={item} data={data}>
        {item.kind === 'brief' || item.stage === 'approve' ? (
          evidence
        ) : (
          <Collapsible open={shown} onOpenChange={setShown} className="needs-review-disclosure">
            <CollapsibleTrigger render={<Button variant="ghost" className="needs-review-toggle" />}>
              {shown ? 'Hide packet' : 'Show packet'}
            </CollapsibleTrigger>
            <CollapsibleContent keepMounted className="needs-review-panel">
              {evidence}
            </CollapsibleContent>
          </Collapsible>
        )}
      </OpenHeader>
      <WaitingOn item={item} data={data} />
      <DecisionFooter {...parts} action={act({ item, data })} working={working} openCard={open} />
    </>
  );
};
