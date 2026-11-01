import type { BoardEmptyProps } from '../types.ts';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { LoaderCircle } from 'lucide-react';

/** A board with no jobs: one line on what happens next; Add job lives in the title row. */
export const BoardEmpty = ({ working, act, data }: BoardEmptyProps) => (
  <section className="board-empty ui-tray" aria-labelledby="board-empty-title">
    <span className="board-empty-crew" aria-hidden="true">
      <RoleAvatar agentRole="scout" />
      <RoleAvatar agentRole="writer" />
      <RoleAvatar agentRole="reviewer" />
    </span>
    <div className="board-empty-copy">
      <h2 id="board-empty-title">Start with a job post</h2>
      <p>
        Scout scores the fit, Writer drafts from your profile and Reviewer checks every claim. You
        approve the exact packet before anything leaves this device.
      </p>
    </div>
    {data.demoAvailable ? (
      <Button
        variant="outline"
        size="sm"
        disabled={working}
        onClick={() => act('/examples', 'POST', undefined, 'Loaded example jobs (demo runtime)')}
      >
        {working ? <LoaderCircle size={14} className="spin" /> : null} Load example data
      </Button>
    ) : null}
  </section>
);
