import { lazy, Suspense, useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { Snapshot } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  WorkspaceHeaderActions,
  WorkspaceHeaderFact,
  WorkspaceHeaderPrimary,
} from '@/App/components/WorkspacePage.tsx';
import { crewSummary } from '@/CrewPage/helpers.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Plus } from 'lucide-react';

/** Crew's title-row actions: contextual Skills and Routines links and the one glaze New agent. */
export const CrewTitleActions = ({ data, working }: { data: Snapshot; working: boolean }) => {
  const [open, setOpen] = useState(false);
  const reload = useWorkspaceStore((state) => state.reload);
  const setToast = useWorkspaceStore((state) => state.setToast);
  const full = data.roles.length >= 50;
  return (
    <>
      <WorkspaceHeaderFact>{crewSummary(data)}</WorkspaceHeaderFact>
      <WorkspaceHeaderActions>
        <Button className="button small" nativeButton={false} render={<Link to="/skills" />}>
          Skills
        </Button>
        <Button className="button small" nativeButton={false} render={<Link to="/routines" />}>
          Routines
        </Button>
      </WorkspaceHeaderActions>
      <WorkspaceHeaderPrimary>
        <Button
          className="button small primary"
          disabled={working || full}
          title={full ? 'All 50 stored role IDs are in use, including retired roles.' : undefined}
          onClick={() => setOpen(true)}
        >
          <Plus size={14} aria-hidden="true" /> New agent
        </Button>
      </WorkspaceHeaderPrimary>
      {full ? (
        <p className="ui-row-meta crew-full">
          All 50 stored role IDs are in use, including retired roles.
        </p>
      ) : null}
      {open ? (
        <Suspense fallback={null}>
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
    </>
  );
};

const AgentCreation = lazy(() =>
  import('@/AgentCreation/index.tsx').then((module) => ({ default: module.AgentCreation })),
);
