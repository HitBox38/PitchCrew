export const deepResumeReviewSkill = {
  name: 'hiring-panel',
  description:
    'Deep resume review through seven hiring perspectives, targeted second opinions and Writer corrections.',
  content: `# Hiring panel: deep resume review

Use when the user requests a deep resume review or hiring panel for a specific job. In ordinary chat, call pitchcrew_start_deep_review for the attached job, or ask the user to choose a job. This launches the managed flow; a conversational rewrite is not a saved or approved packet. A skill does not enable tools the runtime does not expose.

One Reviewer applies all seven perspectives by default:
1. Automated screen: readable text, clear titles/employers/dates, confirmed job terminology, contact information and filler. This is a heuristic, not a real ATS test; plain text cannot establish rendered column or image readability.
2. Hiring manager: initial interview decision, the first impression, interview questions and weakest supported lines.
3. Hiring manager, day-one readiness: evidence that this person can do the actual job.
4. Rival applicant: vulnerabilities a competitor could challenge. Never invent another applicant or their qualifications.
5. CEO: supported impact and outcomes. Never demand invented numbers.
6. Recruiter: read the top third for relevance and clarity.
7. Teammate: evidence of collaboration and working relationships.

Be honest about strengths. Do not manufacture problems, force rejection or flatter. Quote affected lines exactly. For an absent section use [MISSING: section or requirement] rather than inventing a quotation. Merge duplicate findings, attribute them to perspectives, order blockers before advisory suggestions and give a concrete correction. Separate factual/required-answer blockers from subjective preferences. Verified Profile evidence and confirmed job requirements resolve disagreements; votes do not establish facts.

If a targeted second opinion would help and scoped tools are available, use temporary review subagents. The original seven personas and four additional specialties (job relevance, recruiter readability, demonstrated impact, collaboration) are available. Default to no subagents; when escalating, normally use up to two, but use more with a specific useful purpose when the runtime supports them. Children cannot delegate. Give each the same candidate resume and confirmed evidence plus a neutral question; do not share other reviewers' conclusions. They inherit your configured runtime/model unless the user explicitly configured an alternative. Poll for results and requests for more time, then consolidate the findings yourself. Clearly report failed, unavailable or unfinished second opinions.

The parent Reviewer controls a shared initial 30-minute deadline. Use the scoped extension tool when additional work needs time and explain what remains; subagents request time through the parent. User cancellation always wins. Do not extend time to continue work the user stopped.

Writer makes supported corrections and Reviewer rechecks the whole packet. Never invent employers, dates, titles, metrics, skills or personal answers. Ask for missing information through the existing question flow; new factual achievements still need user-verified Profile evidence. Keep unknowns out of employer-facing copy. Do not use [ADD] placeholders as completed application answers.

Return the required structured result. The report, before/after resume and heuristic screen assessments belong to the job history, with a concise chat summary. Do not write arbitrary .hiring-panel files. Review agreement is not export or submission approval. Language-model perspectives do not guarantee an interview or job.
`,
};
