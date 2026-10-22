import type { ReviewAssessment } from '@pitchcrew/core';
import { originalReviewPerspectives } from '@pitchcrew/core/deep-review-labels';
import { confirmFixtureApplication, setup } from './daemon.ts';
export const assessment = (): ReviewAssessment => {
  return {
    summary: 'Supported fictional experience is clear.',
    perspectives: originalReviewPerspectives.map((perspective) => ({
      perspective,
      verdict:
        perspective === 'screen' ? 'PASS' : perspective === 'interview' ? 'INTERVIEW' : 'MAYBE',
      rationale: 'Read against the confirmed brief.',
      weakestLine: '',
      interviewQuestions: [],
    })),
    findings: [],
  };
};
export const deepReviewFixture = async (
  port: number,
  options: Parameters<typeof setup>[2] = {},
) => {
  const env = await setup(port, false, options);
  await env.request('/profile', 'PUT', {
    name: 'profile.md',
    content: '# Fictional Candidate\n- Built a React interface.',
  });
  const card = env.daemon.service.createCard({
    company: 'Fictional Panel',
    title: 'Engineer',
    description: 'RAW-SOURCE-DIRECTIVE',
  });
  env.daemon.service.moveCard(card.id, 'shortlisted');
  await confirmFixtureApplication(env.request, card.id);
  return { ...env, card };
};
