import { careerSkill } from './common.ts';

export const interviewPreparation = careerSkill(
  'career-interview-preparation',
  'Prepare for an interview with a sourced, role-specific plan, priority gaps and a quick reference.',
  ['modes/interview-prep.md', 'modes/interview/plan.md'],
  `# Prepare for an interview

Establish the role, round type, interview timing and realistic preparation time; use supplied interviewer details when available. If the user has no date, make a prioritized plan without invented time blocks. Distinguish recruiter screening, hiring-manager, technical/domain, behavioral and design/case rounds; do not default every session to technical trivia.

Compare the job's material requirements with supported Profile experience. Identify strengths to anchor on, missing evidence, confirmed gaps and gaps observed in earlier practice. Prioritize actual demonstrated difficulties over speculative ones and size the plan to the user's available time, including breaks. Ask about conflicts rather than inventing a stronger narrative.

Research public company/product information and relevant interview reports when useful and permitted. Separate official facts, anecdotal interview reports and questions inferred from the job; attach source links to reported questions and never present them as guaranteed future questions. Reuse relevant recent research from the conversation or sourced memory before repeating it. Sparse research is a coverage gap, not a reason to manufacture company knowledge.

Return a compact preparation plan with priorities and time estimates when supported, a small question set suited to the round, source-backed experience to practice, and questions the user can ask the interviewer. End with a short pre-interview reference: key messages, highest-priority gaps and next actions. Suggest practice when useful without starting it automatically. Keep public company observations separate from the user's own motivations; ask the user for personal views instead of deriving them from research.`,
  true,
);
