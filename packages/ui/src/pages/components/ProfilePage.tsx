import { ProfileView } from '@/pages/constants.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useShallow } from 'zustand/react/shallow';

export function ProfilePage() {
  const { data, action, working } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      action: state.action,
      working: state.working,
    })),
  );
  if (!data) return null;
  return <ProfileView data={data} action={action} working={working} />;
}
