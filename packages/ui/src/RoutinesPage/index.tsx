import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { RoutinesWorkspace } from './components/RoutinesWorkspace.tsx';

export function RoutinesPage() {
  const data = useWorkspaceStore((state) => state.data);
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  return data ? <RoutinesWorkspace data={data} action={action} working={working} /> : null;
}
