import { Link } from '@tanstack/react-router';
import type { Snapshot } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { crewLine } from '../helpers.ts';

type DeskEndProps = { data: Snapshot; now: number; decided: boolean };

/**
 * The desk's close once nothing waits, said plainly: after decisions this session, that nothing
 * else needs the user; otherwise what the crew does instead. With no jobs yet, and setup put away,
 * it offers the first step. Focus lands on the line after the last decision.
 */
export const DeskEnd = ({ data, now, decided }: DeskEndProps) => {
  const setAdd = useWorkspaceStore((state) => state.setAdd);
  const firstJob = !data.cards.length && data.onboarding?.status !== 'setup';
  return (
    <div className="needs-end">
      <p className="needs-end-line" tabIndex={-1} data-needs-end="">
        {decided ? (
          <strong>Nothing else needs you. The crew carries on.</strong>
        ) : (
          <>
            <strong>Nothing needs you right now.</strong> {crewLine(data, now)}
          </>
        )}
      </p>
      {firstJob ? (
        <div className="needs-end-actions">
          <Button variant="outline" onClick={() => setAdd(true)}>
            Add your first job
          </Button>
          <Button variant="ghost" nativeButton={false} render={<Link to="/pipeline" />}>
            Open Pipeline
          </Button>
        </div>
      ) : null}
    </div>
  );
};
