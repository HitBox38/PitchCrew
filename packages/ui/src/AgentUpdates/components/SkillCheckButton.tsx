import { Button } from '@/components/ui/button/components/Button.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { RefreshCw } from 'lucide-react';

export const SkillCheckButton = () => {
  const check = useWorkspaceStore((state) => state.checkSkills);
  const busy = useWorkspaceStore(
    (state) => state.checkingSkills || state.data?.skillUpdates?.checking,
  );
  return (
    <Button className="button small" disabled={busy} onClick={() => void check()}>
      <RefreshCw size={14} aria-hidden="true" className={busy ? 'spin' : ''} />
      {busy ? 'Checking skills…' : 'Check now'}
    </Button>
  );
};
