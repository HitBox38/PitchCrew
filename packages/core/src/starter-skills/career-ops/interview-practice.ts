import { careerSkill } from './common.ts';

export const interviewPractice = careerSkill(
  'career-interview-practice',
  'Rehearse one interview question at a time, with coached feedback or an uninterrupted mock interview.',
  ['modes/interview/practice.md'],
  `# Practice an interview

Use coached practice by default; honor an explicit request for a mock interview. Establish the target role and round from context, asking only when essential. Use user-recalled real questions first, relevant sourced reports next, then clearly labelled generated questions. If role research or prior questions are missing, say what the practice can and cannot cover; a user can still choose generic practice.

Ask exactly one question, without revealing an ideal answer or hints, then wait for the user's answer. Use pitchcrew_ask_user for the question and end the turn so the existing durable question/continuation flow handles the wait. Accept a natural-language answer or follow-up from the user; do not simulate their response or run an entire interview in one turn. Natural follow-ups also ask one question and wait. Never infer pause, readiness or consent from silence.

In coached practice, after each completed answer give specific strengths and one or two useful corrections, quoting the user's actual words where helpful. Offer a concise stronger opening or closing grounded only in their stated experience or Profile. Flag unsupported numbers and ask whether they can substantiate them; a confident rewrite cannot make a claim true. Invite a retry or move to the next question according to the user's choice. For behavioral stories, explore the situation, the user's own action, outcome and reflection without filling missing details yourself.

In mock mode, stay in the interviewer role and defer assessment, hints and improved versions until the user ends the round or reaches an agreed question count. Ask relevant follow-ups without coaching. Stop or pause immediately when requested, and switch modes if the user asks. Ask for session length if a bounded mock is requested without a count; do not invent a time measurement from typed answers.

At the end, summarize questions covered, supported strengths, specific gaps, repeated examples and next practice steps. Assess content and structure of typed responses; do not claim to measure speaking pace, vocal tone, body language or elapsed delivery time. Save concise continuity notes, including corrected or withdrawn claims, rather than another full transcript.`,
  true,
);
