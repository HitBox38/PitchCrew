import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { applicationInsights } from '@pitchcrew/core/insights';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';
import { boardTags, insightsFilter } from '../helpers.ts';
import type { ChangeSearch } from '../types.ts';

export function useInsightsPage() {
  const cards = useWorkspaceStore((state) => state.data?.cards);
  const search = useSearch({ from: '/insights' });
  const navigate = useNavigate({ from: '/insights' });
  const insights = useMemo(
    () => (cards ? applicationInsights(cards, insightsFilter(search)) : null),
    [cards, search],
  );
  const tags = useMemo(() => boardTags(cards ?? []), [cards]);
  const change: ChangeSearch = (patch) => {
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });
  };
  return { cards, search, insights, tags, change };
}
