import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useShallow } from 'zustand/react/shallow';
import { DecisionsView } from '@/Decisions/index.tsx';

export const InboxPage = () => {
  const { data, action, working, openCard } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      action: state.action,
      working: state.working,
      openCard: state.openCard,
    })),
  );
  if (!data) return null;
  return <DecisionsView data={data} action={action} working={working} openCard={openCard} />;
};
