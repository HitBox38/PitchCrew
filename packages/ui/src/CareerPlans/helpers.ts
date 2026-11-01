import type { CareerPlan } from '@pitchcrew/core';

/** One line naming a plan's chosen scope: role text, tag and individually chosen jobs. */
export const planScope = (scope: CareerPlan['scope']): string => {
  const parts = [
    scope.title ? `Role: ${scope.title}` : '',
    scope.tag ? `Tag: ${scope.tag}` : '',
    scope.cardIds.length
      ? `${scope.cardIds.length} chosen ${scope.cardIds.length === 1 ? 'job' : 'jobs'}`
      : '',
  ].filter(Boolean);
  return parts.join(' · ') || 'No scope';
};
