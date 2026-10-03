import type { BoardWelcomeProps } from '@/BoardPage/types.ts';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { LoaderCircle, Plus } from 'lucide-react';

export function BoardWelcome({ setAdd, working, act, data }: BoardWelcomeProps) {
  return (
    <section className="welcome">
      <h2>Start with a job post</h2>
      <p>
        Add a listing you’re considering. The crew works on it one step at a time, and only when you
        ask.
      </p>
      <ol className="welcome-steps">
        <li>
          <RoleAvatar agentRole="scout" size="small" />
          <span>
            <strong>Scout</strong> reads the post and scores the fit against your profile.
          </span>
        </li>
        <li>
          <RoleAvatar agentRole="writer" size="small" />
          <span>
            <strong>Writer</strong> drafts a resume, cover letter and form answers, quoting only
            your notes.
          </span>
        </li>
        <li>
          <RoleAvatar agentRole="reviewer" size="small" />
          <span>
            <strong>Reviewer</strong> checks every claim against those notes.
          </span>
        </li>
        <li>
          <span className="step-you">You</span>
          <span>
            approve the exact packet before it’s exported to a folder. Browser interactions require
            your approval.
          </span>
        </li>
      </ol>
      <div className="welcome-actions flex gap-2.5 max-compact:flex-wrap">
        <Button className="button primary" onClick={() => setAdd(true)}>
          <Plus size={16} /> Add job
        </Button>
        {data.demoAvailable && (
          <Button
            className="button"
            disabled={working}
            onClick={() =>
              act('/examples', 'POST', undefined, 'Loaded example jobs (demo runtime)')
            }
          >
            {working ? <LoaderCircle size={14} className="spin" /> : null} Load example data
          </Button>
        )}
      </div>
    </section>
  );
}
