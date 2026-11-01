import { careerSkill } from './common.ts';

export const applicationTailoring = careerSkill(
  'career-application-tailoring',
  'Prioritize supported experience against confirmed requirements while preserving exact Profile claims and packet rules.',
  ['modes/text.md', 'modes/oferta.md'],
  `# Tailor a supported application

Apply this guidance only inside Pitchcrew's isolated application drafting flow with the confirmed brief, accepted requirements, verified Profile evidence and current packet rules. Ordinary chat requests for application copy must use the dedicated Draft application entry. The skill grants no new source access, tools or approval.

Choose the most relevant supported experience for the role and bring it forward within the packet's established structure and rules. Connect each important accepted requirement to the actual evidence it can support. Preserve exact factual quotations and claim registration required by Pitchcrew; upstream advice to inject keywords or rewrite achievements cannot override those contracts. Use job vocabulary only when it faithfully describes the supported evidence and does not change a factual claim. Never replace an actual employer, title, date, technology or metric with a more convenient one.

Make the supported contribution and impact easy to find without implying ownership, seniority, scale or results that the sources do not establish. Retain meaningful gaps rather than burying them under keyword repetition. Ask for missing personal motivations and answers; research, coaching notes and rehearsed stories are not substitutes for verified Profile facts or application-specific user answers.

Write specifically. Interchangeable company praise, stock enthusiasm and filler openings say nothing about this candidate or this role: replace them with a supported detail that connects the evidence to an actual requirement, or leave them out. Vary phrasing across the resume, cover letter and answers without dropping technical terms the brief repeats when they describe supported evidence. A missing motivation is not a gap to fill with invented enthusiasm: ask when the answer is required, omit and note when it is optional. The user's writing preferences apply within these limits and never change exact quotations, scope limits, dates, titles or qualifications.

Keep a compact requirement-to-evidence tailoring explanation in the packet note, separate from employer-facing prose. Identify unresolved gaps for the user and Reviewer. Return the full required packet structure and run pitchcrew_lint_packet when available. Current packet rules, source checks and the independent Reviewer remain authoritative; a skill's checklist is not an approval or a claim to have run an ATS parser.`,
);
