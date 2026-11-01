import type { Approval, Card, ComputerApproval, Snapshot } from '@pitchcrew/core';
import { BrowserApprovalDetails } from '@/components/InboxView/components/BrowserApprovalDetails.tsx';
import { PacketDetails } from '@/components/InboxView/components/PacketDetails.tsx';
import type { Decision } from '@/ClayInterface/signals.ts';
import { BriefDecision } from './BriefDecision.tsx';

type DecisionBodyProps = {
  decision: Decision;
  data: Snapshot;
  card: Card | undefined;
  packet: Approval | undefined;
  browser: ComputerApproval | undefined;
};

/** The evidence for the decision; its buttons live in the pinned footer. Questions use QuestionSheet. */
export const DecisionBody = ({ decision, data, card, packet, browser }: DecisionBodyProps) => {
  if (decision.kind === 'packet' && packet) return <PacketDetails approval={packet} data={data} />;
  if (decision.kind === 'browser' && browser) return <BrowserApprovalDetails approval={browser} />;
  if (decision.kind === 'brief' && card) return <BriefDecision card={card} />;
  return null;
};
