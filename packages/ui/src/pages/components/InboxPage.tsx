import { InboxView } from '@/pages/constants.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useShallow } from 'zustand/react/shallow';

export function InboxPage() {
  const { data, action, working, openCard } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      action: state.action,
      working: state.working,
      openCard: state.openCard,
    })),
  );
  if (!data) return null;
  return <InboxView data={data} action={action} working={working} onOpen={openCard} />;
}
