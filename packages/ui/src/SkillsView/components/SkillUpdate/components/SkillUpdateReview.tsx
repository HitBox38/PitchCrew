import { Modal } from '@/components/Modal/index.tsx';
import type { useSkillUpdate } from '../hooks/useSkillUpdate.ts';
import { LoaderCircle } from 'lucide-react';
import SkillUpdateChanges from './SkillUpdateChanges.tsx';
import { SkillUpdateActions } from './SkillUpdateActions.tsx';

/** 720px review: exact fetched changes, Keep mine or Use this update. Nothing applies on open. */
export const SkillUpdateReview = (c: ReturnType<typeof useSkillUpdate>) => {
  return (
    <Modal title="Review skill update" onClose={c.close} className="skills-update-dialog">
      <div className="skills-update-scroll">
        {c.loading ? (
          <output className="skills-update-summary" aria-live="polite">
            <LoaderCircle size={16} className="spin" aria-hidden="true" /> Checking skills.sh for
            updates…
          </output>
        ) : c.review ? (
          <>
            <output className="skills-update-summary" aria-live="polite">
              {c.review.changed
                ? `${c.review.current.name} has a newer version.`
                : `${c.review.current.name} is up to date. No changes found.`}
            </output>
            {c.review.changed ? (
              <>
                <p className="skills-update-consequence">
                  Using it replaces the saved name, description and instructions, including any
                  local edits. Agent assignments are kept. Future runs use the update.
                </p>
                <SkillUpdateChanges review={c.review} />
              </>
            ) : null}
          </>
        ) : null}
        {c.error ? (
          <p className="form-error" role="alert">
            {c.error}
          </p>
        ) : null}
      </div>
      <SkillUpdateActions {...c} />
    </Modal>
  );
};
