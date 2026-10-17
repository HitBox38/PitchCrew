import { careerSkill } from './common.ts';

export const offerEvaluation = careerSkill(
  'career-offer-evaluation',
  'Compare compensation and walk through offer terms, discrepancies and negotiation questions; draft replies on request.',
  ['modes/offer-prep.md'],
  `# Evaluate an employment offer

Read the actual supplied offer or contract, relevant attachments and the user's stated priorities. Identify the document/version and any missing, garbled, truncated or unextractable text before analysis; ask for clearer text or missing referenced documents instead of claiming a complete review. Explain only passages that can actually be read. Ask what the user was promised, by whom and when, and distinguish their recollection from supplied written evidence.

Compare stated base pay, currency and pay period, guaranteed versus conditional cash, bonus/commission conditions, equity terms, benefits, location/working arrangement, start date and deadlines when present. Keep unknown fields unknown. Do not add conditional amounts to guaranteed pay or treat equity as cash. Use comparable periods and currencies only with explicit assumptions and sourced current conversion information; distinguish gross from net and do not guess personal taxes or investment value.

Walk through relevant contract provisions in document order, quoting a short source passage for each finding and explaining what it states in plain language. Cover stated vesting, termination/notice, restrictive covenants, confidentiality/IP/side projects, repayment obligations, disputes and employment classification when present. Identify missing referenced documents and differences from promises with their sources. Do not import a jurisdiction's presumed defaults into an omission, label a clause legally safe/unsafe, decide enforceability, or pronounce the contract safe to sign. Turn legal interpretation and local-law questions into specific questions for the user's lawyer. If language or extraction prevents reliable explanation, say so and ask for help rather than inventing a translation.

Public company and compensation research is separate from the private document walkthrough. Use only public company/role information in browser queries; never transmit contract excerpts, the user's offer figures, identity, negotiation floor or private promises. Cite dates and limitations of external comparisons; market reports are not this employer's binding terms. The upstream offer-prep workflow concept acknowledges Anthropic's claude-for-legal hiring-review (Apache-2.0, © 2026 Anthropic PBC); this adaptation uses Pitchcrew's own chat and scoped tools, without its legal tables.

Return the user's priorities, an evidence-backed terms comparison, observed discrepancies, unknowns and questions for the employer or lawyer. Compare multiple supplied offers against the user's chosen priorities without a fabricated universal score. On an explicit request for a negotiation reply, establish the user's desired asks and write a draft using those asks and actual terms. Do not invent a competing offer, salary target, deadline or bargaining fact. The user reviews and sends it; never send, accept, sign or decline an offer. Keep document text out of memory; summarize only useful source-linked decisions and unresolved questions.`,
  true,
);
