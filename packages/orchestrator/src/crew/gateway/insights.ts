import {
  applicationInsights,
  defaultCapabilities,
  insightLimits,
  insightsQuery,
  type ApplicationInsights,
  type Card,
  type Role,
} from '@pitchcrew/core';
import type { CrewContext, RunCapability } from '../types.ts';

export const insightsByteLimit = 64000;
const lessonPreview = 500;

function preview(insights: ApplicationInsights) {
  return {
    ...insights,
    lessons: Object.fromEntries(
      Object.entries(insights.lessons).map(([outcome, lessons]) => [
        outcome,
        lessons.map((lesson) => ({
          ...lesson,
          text:
            lesson.text.length > lessonPreview
              ? `${lesson.text.slice(0, lessonPreview)}…`
              : lesson.text,
        })),
      ]),
    ),
  };
}

/**
 * Read-only aggregate of applications the role can already read through application search
 * or pipeline review. Weights and lessons stay user-written; there is no agent write action.
 */
export function insightsAction(
  context: CrewContext,
  capability: RunCapability,
  token: string,
  input: unknown,
): Record<string, unknown> {
  const role = context.board.get<Role>('role', capability.roleId);
  const permissions = { ...defaultCapabilities, ...role.capabilities };
  const signal = context.controllers.get(capability.runId)?.signal;
  if (!role.enabled || role.retiredAt) throw new Error('This role is disabled or retired.');
  if (context.capabilities.get(token) !== capability || !signal || signal.aborted)
    throw new Error('Application insights require an active run.');
  if (permissions.readApplications !== true && permissions.reviewPipeline !== true)
    throw new Error('Enable read applications or pipeline review to read application insights.');
  const query = insightsQuery.parse(input ?? {});
  const cards = context.board.list<Card>('card');
  let { tagLimit, lessonLimit } = query;
  // Halve the longest lists until the response fits, and say so instead of failing.
  for (;;) {
    const result = {
      ...preview(applicationInsights(cards, { ...query, tagLimit, lessonLimit })),
      truncated: tagLimit < query.tagLimit || lessonLimit < query.lessonLimit,
      limits: {
        maximumTags: insightLimits.tags,
        maximumLessonsPerOutcome: insightLimits.lessons,
        lessonCharacters: lessonPreview,
        maximumBytes: insightsByteLimit,
      },
      note: 'Weights and lessons are the user’s own judgments. Outcomes show what happened, not why. Read-only: agents cannot set weights, lessons, tags or no-response status.',
    };
    if (Buffer.byteLength(JSON.stringify(result), 'utf8') <= insightsByteLimit) return result;
    if (lessonLimit > 1) lessonLimit = Math.floor(lessonLimit / 2);
    else if (tagLimit > 1) tagLimit = Math.floor(tagLimit / 2);
    else throw new Error('Insights exceed the 64 KB limit. Narrow the tag or date filter.');
  }
}
