import { careerSkill } from './common.ts';

export const interviewDebrief = careerSkill(
  'career-interview-debrief',
  'Capture a completed interview and turn recalled questions and actual feedback into next-round preparation.',
  ['modes/interview/debrief.md'],
  `# Debrief an interview

Start with what the user already supplied, including a transcript or attachment. Establish company/role, round and date when available. Ask one focused question at a time to fill material gaps in what was asked, how the user answered, actual interviewer feedback and known next-round details. Do not demand perfect recall or reconstruct missing dialogue as fact.

Separate three sources throughout: the user's recollection, attributable employer feedback, and your interpretation. Quote the supplied wording where useful and identify uncertain recollection. A rejection or an interviewer expression does not prove why the employer decided. Next-round predictions are hypotheses unless the process was explicitly described.

Identify concrete strengths, unanswered follow-ups and examples that lacked evidence or clarity. Check any suggested stronger answer against Profile or the user's own account; never add a metric, responsibility or opinion. If the user retracts a claim, carry that correction into the summary and future practice, and explain any conflict with older material without silently editing Profile.

Return a concise debrief with questions asked, feedback and uncertainty, lessons to practice, and a prioritized plan for the next known round. Preserve relevant real questions in source-linked memory with their role/round context so future practice can reuse them without treating them as guaranteed future questions. Keep suggested lessons in chat/memory; application Insights lessons and weights remain user-written.`,
  true,
);
