import type { Skill } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { RefreshCw } from 'lucide-react';
import { useSkillUpdate } from './hooks/useSkillUpdate.ts';
import { SkillUpdateReview } from './components/SkillUpdateReview.tsx';

export function SkillUpdate({
  skill,
  action,
  working,
  requested = false,
  onReviewClose,
}: {
  skill: Skill;
  action: Action;
  working: boolean;
  requested?: boolean;
  onReviewClose: () => void;
}) {
  const c = useSkillUpdate(skill, action, working, requested, onReviewClose);
  return (
    <>
      <Button
        className="button small"
        onClick={() => void c.check()}
        disabled={working || c.loading}
        aria-label={`Check for updates to ${skill.name}`}
      >
        <RefreshCw size={14} className={c.loading ? 'spin' : ''} />{' '}
        {c.loading ? 'Checking…' : 'Update'}
      </Button>
      {c.open ? <SkillUpdateReview {...c} /> : null}
    </>
  );
}
