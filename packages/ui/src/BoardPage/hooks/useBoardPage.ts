import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import { closedStates } from '@/board-stages.ts';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

export function useBoardPage() {
  const reduced = useAppReducedMotion();
  const {
    data,
    working,
    act,
    openCard,
    setAdd,
    query,
    setQuery,
    showClosed,
    setShowClosed,
    flashStage,
    setFlashStage,
  } = useWorkspaceStore(
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
      flashStage: state.flashStage,
      setFlashStage: state.setFlashStage,
    })),
  );
  const { go } = useWorkspaceNavigation();
  useEffect(() => {
    if (!flashStage) return;
    document.getElementById(`stage-${flashStage}`)?.scrollIntoView({
      behavior: reduced ? 'instant' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
    const timer = setTimeout(() => setFlashStage(null), 1400);
    return () => clearTimeout(timer);
  }, [flashStage, setFlashStage, reduced]);
  if (!data) return null;
  const active = data.cards.filter((c) => !closedStates.includes(c.state));
  const filtered = data.cards.filter((c) =>
    `${c.company} ${c.title} ${c.location} ${c.tags.join(' ')}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const closed = filtered.filter((c) => closedStates.includes(c.state));
  const recent = data.events.filter((e) => e.kind !== 'role').slice(0, 4);
  return {
    reduced,
    data,
    working,
    act,
    openCard,
    setAdd,
    query,
    setQuery,
    showClosed,
    setShowClosed,
    flashStage,
    go,
    active,
    filtered,
    closed,
    recent,
  };
}
