import { RuntimeList } from './RuntimeList.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { Snapshot } from '@pitchcrew/core';
import { Link } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';

export function RuntimeSettings({ runtimes }: { runtimes: Snapshot['runtimes'] }) {
  const working = useWorkspaceStore((state) => state.working);
  const act = useWorkspaceStore((state) => state.act);
  return (
    <div>
      <div className="settings-row pt-0">
        <p className="quiet">
          Check installed CLIs, then choose a runtime for each agent in <Link to="/crew">Crew</Link>
          .
        </p>
        <Button
          className="button"
          disabled={working}
          onClick={() =>
            void act('/runtimes/detect', 'POST', undefined, 'Checked installed runtimes')
          }
        >
          <RefreshCw size={15} /> Check runtimes
        </Button>
      </div>
      <RuntimeList runtimes={runtimes} />
    </div>
  );
}
