import { RuntimeUpdateSettings } from '@/RuntimeMaintenance/components/RuntimeUpdateSettings.tsx';
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
    <section className="settings-section settings-runtimes">
      <div className="settings-runtime-toolbar flex flex-wrap items-start justify-between gap-3">
        <p className="quiet max-w-[58ch]">
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
      <RuntimeUpdateSettings />
      <RuntimeList runtimes={runtimes} />
    </section>
  );
}
