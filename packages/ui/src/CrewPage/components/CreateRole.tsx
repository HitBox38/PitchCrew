import { lazy, Suspense, useState } from 'react';
import type { Snapshot } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
const AgentCreation = lazy(() =>
  import('@/AgentCreation/index.tsx').then((module) => ({ default: module.AgentCreation })),
);
export function CreateRole({ data, working }: { data: Snapshot; working: boolean }) {
  const [open, setOpen] = useState(false);
  const reload = useWorkspaceStore((state) => state.reload);
  const setToast = useWorkspaceStore((state) => state.setToast);
  return (
    <div className="mb-4">
      <Button
        className="button primary"
        disabled={working || data.roles.length >= 50}
        onClick={() => setOpen(true)}
      >
        Create agent
      </Button>
      {data.roles.length >= 50 ? (
        <p className="quiet">All 50 stored role IDs are in use, including retired roles.</p>
      ) : null}
      {open ? (
        <Suspense fallback={<output className="quiet">Loading agent setup…</output>}>
          <AgentCreation
            data={data}
            working={working}
            onClose={() => setOpen(false)}
            onCreated={(role) => {
              setToast(`${role.name} created`, 'success');
              void reload().catch(() => {});
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
