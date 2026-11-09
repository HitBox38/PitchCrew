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
// Placeholders stay schema-valid so a literally copied example never fails validation.
export const reviewSummaryShape =
  '"summary":{"assessment":"One to three sentences for the user","highlights":[],"limitations":[],"nextSteps":["One concrete step for the user"]}';
const writerPacketShape =
  '"packet":{"resume":"markdown","coverLetter":"markdown","formAnswers":"markdown","note":"markdown","claims":[{"claim":"exact profile quote","source":"profile.md","quote":"exact profile quote"}]}';
/**
 * The Writer's result example. A first draft omits changes entirely (an empty list is rejected);
 * a revision of an existing packet supplies at least one change note.
 */
export const writerResultShape = (revising: boolean) =>
  `{"role":"writer","changeSummary":"One sentence describing the completed work",${writerPacketShape}${revising ? ',"changes":["What changed from the previous draft and the finding or answer it addresses"]' : ''}}`;
/** Tells the Writer which packet mode this run is in, so the example and instructions agree. */
export const writerModeInstructions = (revising: boolean) =>
  revising
    ? 'This run revises the existing packet: include changes with one to eight non-empty notes.'
    : 'This run writes the first draft: there is no existing packet, so omit the changes field entirely. Never return an empty changes list.';
