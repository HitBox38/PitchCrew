import type { RunContext } from '@pitchcrew/core';

const writerQuality =
  'Writing quality: replace interchangeable company praise, stock enthusiasm and filler openings with specific, supported details that connect the candidate to the actual requirements, or omit them. Vary sentence openings and avoid repeating the same phrasing across documents, but keep technical terms, product names and other terminology the brief repeats when they describe supported evidence. Never satisfy a motivation or personal question by inventing enthusiasm, opinions or experiences: a required personal answer without a confirmed user answer is a user question, and an optional one is omitted and noted in the packet note. Apply the user’s writing preferences within these limits. Stylistic changes never alter exact Profile quotations, scope limits, dates, titles, qualifications or confirmed requirements. When you revise, make each change note name the passage it reworded and the supported detail it now uses, so the user can tell a rewording from a factual change.';
const reviewerQuality =
  'Writing quality: identify generic phrasing, interchangeable praise, stock enthusiasm and repetitive wording by quoting the affected passage and suggesting a supported, more specific replacement. Generic phrasing alone is an optional style finding and belongs in suggestions, never in feedback. Report it in feedback only when a packet rule error makes it blocking or a required answer is addressed entirely with interchangeable copy and so inadequately answers the requirement; say which case applies. Never request invented motivations or experiences as a correction. Keep useful repeated technical terminology. When the packet passes, state its writing quality plainly in the summary assessment and put remaining optional style suggestions in limitations. Summary, suggestions and feedback never claim an AI-detector result, an ATS parse or an employer decision.';

/** Writing-quality guidance for isolated drafting and review; excluded from fit, evaluation and perspective subagents. */
export const writingQualityInstructions = (seat: string | null, context: RunContext) => {
  if (context.deepReview?.subagent || context.purpose === 'packet-evaluation') return '';
  return seat === 'reviewer' ? reviewerQuality : seat === 'writer' ? writerQuality : '';
};
