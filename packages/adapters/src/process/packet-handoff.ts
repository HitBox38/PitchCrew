import type { RunContext } from '@pitchcrew/core';

const reviewerHandoff =
  'When the packet passes, include summary for the user who decides whether to approve it: assessment is your final verdict in one to three plain sentences; highlights are useful facts about this packet (which requirements it leads with, its strongest evidence, choices the user should know about); limitations are known gaps (unanswered optional questions, manual, hidden or uninspected form sections, documents this packet cannot provide); nextSteps are concrete things the user should do before or after approving (files or fields they must supply themselves, details to check against the posting). Each item is one short sentence. Do not restate packet contents or claim anything was exported or submitted. A passing result without summary is rejected. Omit summary when the packet fails; use feedback instead.';
const writerHandoff =
  'When you revise an existing packet, include changes: one to eight short sentences describing what changed from the previous draft and which review finding or user answer each change addresses. Omit changes for a first draft.';

/** What Writer and Reviewer tell the user about a packet, beyond the packet itself. */
export const packetHandoffInstructions = (seat: string | null, context: RunContext) => {
  if (context.deepReview?.subagent || context.purpose === 'packet-evaluation') return '';
  return seat === 'reviewer' ? reviewerHandoff : seat === 'writer' ? writerHandoff : '';
};
export const reviewSummaryShape =
  '"summary":{"assessment":"","highlights":[],"limitations":[],"nextSteps":[""]}';
