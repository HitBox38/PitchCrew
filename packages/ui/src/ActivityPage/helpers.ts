import { eventKindLabels } from './constants.ts';
export function validateActivitySearch(search: Record<string, unknown>): {
  q?: string;
  kind?: keyof typeof eventKindLabels;
} {
  return {
    q: typeof search.q === 'string' ? search.q.slice(0, 200) || undefined : undefined,
    kind:
      typeof search.kind === 'string' && Object.hasOwn(eventKindLabels, search.kind)
        ? (search.kind as keyof typeof eventKindLabels)
        : undefined,
  };
}
