import type { BaseSkill } from '../../base-skills.ts';
import { applicationReview } from './application-review.ts';
import { applicationTailoring } from './application-tailoring.ts';
import { careerPlanning } from './career-planning.ts';
import { fitAssessment } from './fit-assessment.ts';
import { interviewDebrief } from './interview-debrief.ts';
import { interviewPractice } from './interview-practice.ts';
import { interviewPreparation } from './interview-preparation.ts';
import { offerEvaluation } from './offer-evaluation.ts';

export const careerSkills: BaseSkill[] = [
  { skill: fitAssessment, file: 'fit-assessment', roles: ['scout'] },
  { skill: applicationTailoring, file: 'application-tailoring', roles: ['writer'] },
  { skill: applicationReview, file: 'application-review', roles: ['reviewer'] },
  { skill: interviewPreparation, file: 'interview-preparation', roles: ['career-coach'] },
  { skill: interviewPractice, file: 'interview-practice', roles: ['career-coach'] },
  { skill: interviewDebrief, file: 'interview-debrief', roles: ['career-coach'] },
  { skill: careerPlanning, file: 'career-planning', roles: ['career-coach'] },
  { skill: offerEvaluation, file: 'offer-evaluation', roles: ['career-coach'] },
].map(({ skill, file, roles }) => ({
  ...skill,
  source: 'Pitchcrew',
  sourceType: 'bundled',
  skillPath: `src/starter-skills/career-ops/${file}.ts`,
  defaultRoles: roles,
  note: 'Included offline. Adapted from career-ops for Pitchcrew; updates ship through reviewed releases.',
}));
