import { closedStateSet } from '@/board-stages.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useShallow } from 'zustand/react/shallow';
import { useBoardJobMutations } from './useBoardJobMutations.ts';
import { useBoardStage } from './useBoardStage.ts';
import { matchesJobQuery } from '../helpers.ts';

export const useBoardPage = () => {
  const jobMutations = useBoardJobMutations();
  const { data, working, act, openCard, setAdd, query, setQuery, showClosed, setShowClosed } =
    useWorkspaceStore(
      useShallow((state) => ({
        data: state.data,
        working: state.working,
        act: state.act,
        openCard: state.openCard,
        setAdd: state.setAdd,
        query: state.query,
        setQuery: state.setQuery,
        showClosed: state.showClosed,
        setShowClosed: state.setShowClosed,
      })),
    );
  const stage = useBoardStage(showClosed, setShowClosed, setQuery);
  if (!data) return null;
  const filtered = data.cards.filter((card) => matchesJobQuery(card, query));
  const closedTotal = data.cards.filter((card) => closedStateSet.has(card.state)).length;
  const closedMatches = filtered.filter((card) => closedStateSet.has(card.state)).length;
  return {
    jobMutations,
    data,
    working,
    act,
    openCard,
    setAdd,
    query,
    setQuery,
    showClosed,
    setShowClosed,
    filtered,
    stage,
    counts: {
      active: { matching: filtered.length - closedMatches, total: data.cards.length - closedTotal },
      closed: { matching: closedMatches, total: closedTotal },
    },
  };
};
