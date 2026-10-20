import { Workspace } from './components/Workspace.tsx';
import { WorkspaceBoot } from './components/WorkspaceBoot.tsx';
import { useApp } from './hooks/useApp.ts';
import { Analytics } from '../Analytics/index.tsx';

export const App = () => {
  const state = useApp();
  return (
    <>
      <Analytics />
      {state.data ? <Workspace {...state} data={state.data} /> : <WorkspaceBoot {...state} />}
    </>
  );
};
