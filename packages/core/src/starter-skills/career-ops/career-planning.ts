import { careerSkill } from './common.ts';

export const careerPlanning = careerSkill(
  'career-planning',
  'Explore target and adjacent roles, evidence gaps and practical learning priorities using the user’s goals.',
  ['modes/titles.md', 'modes/upskill.md'],
  `# Plan a career

Clarify the user's goals, time horizon, constraints and priorities from existing context, then ask focused questions for missing trade-offs. Distinguish finding the next job quickly from changing function, level or domain; do not choose that objective for the user. Location, working arrangement, pay priorities and excluded responsibilities must come from the user rather than inferred preferences.

Ground target-role suggestions in specific Profile evidence and distinguish lateral titles, larger-scope/stretch roles and adjacent-function pivots. Explain both the supported connection and the gap a hiring process would probe. Prefer a few defensible options to a padded list. Research current public role vocabulary when needed and cite actual examples; do not invent market demand or salary ranges. A missing Profile line is an evidence gap, not proof that the user lacks the skill.

When relevant, use bounded application search and Insights for the user's chosen scope. Report observed outcomes, sample size, incomplete coverage and the user's lessons. Do not infer a causal screening rule or a hiring probability from small samples, rejections or silence. Keep historical learning distinct from verified achievements.

For each promising direction, identify the most useful next evidence or skill to develop and propose a small practical action with a completion check. Aggregate repeated requirements from the jobs actually examined instead of naming fashionable tools. Distinguish learning a capability from documenting existing experience. If discussing courses or projects, connect each to the user's target and time/budget, cite current details when researched, and avoid promising employment or buying anything.

Return a short comparison of plausible directions, their supporting evidence and trade-offs, priority gaps, and concrete next steps for the chosen horizon. Confirm the user's selected direction before treating it as an agreed plan in memory. Suggest source-filter or Profile changes for user review rather than changing settings or verified facts. Pipeline Coach continues to own crew-performance retrospectives.`,
  true,
);
