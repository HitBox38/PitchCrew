import { Modal } from '@/components/Modal/index.tsx';
import type { useSkillUpdate } from '../hooks/useSkillUpdate.ts';
import { LoaderCircle } from 'lucide-react';
import SkillUpdateChanges from './SkillUpdateChanges.tsx';
import { SkillUpdateActions } from './SkillUpdateActions.tsx';

export function SkillUpdateReview(c: ReturnType<typeof useSkillUpdate>) {
  return (
    <Modal title="Review skill update" onClose={c.close} className="skill-update-dialog">
      <div className="skill-update-scroll">
        {c.loading ? (
          <output className="flex items-center gap-2" aria-live="polite">
            <LoaderCircle size={16} className="spin" /> Checking skills.sh for updates…
          </output>
        ) : c.review ? (
          <>
            <output className="skill-update-summary block" aria-live="polite">
              {c.review.changed
                ? `Review the latest version of ${c.review.current.name}.`
                : `${c.review.current.name} is up to date. No changes found.`}
            </output>
            {c.review.changed ? (
              <>
                <p className="quiet">
                  Approval replaces the saved name, description and instructions, including any
                  local edits. Agent assignments are kept. Future runs use the update.
                </p>
                <SkillUpdateChanges review={c.review} />
              </>
            ) : null}
          </>
        ) : null}
        {c.error ? (
          <p className="form-error mt-3" role="alert">
            {c.error}
          </p>
        ) : null}
      </div>
      <SkillUpdateActions {...c} />
    </Modal>
  );
}
