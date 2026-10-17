import type { ReviewAssessment } from '@pitchcrew/core';
import { originalReviewPerspectives } from '@pitchcrew/core/deep-review-labels';
import { confirmFixtureApplication, setup } from './daemon.ts';
export function assessment(): ReviewAssessment {
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
}
export async function deepReviewFixture(port: number) {
  const env = await setup(port);
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
}
