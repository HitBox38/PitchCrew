import { Workspace } from './components/Workspace.tsx';
import { WorkspaceBoot } from './components/WorkspaceBoot.tsx';
import { useApp } from './hooks/useApp.ts';

export function App() {
  const state = useApp();
  if (!state.data) return <WorkspaceBoot {...state} />;
  return <Workspace {...state} data={state.data} />;
}
