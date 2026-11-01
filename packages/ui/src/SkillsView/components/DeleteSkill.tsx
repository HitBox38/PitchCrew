import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { assignment } from '../helpers.ts';
import type { SkillsViewModel } from '../types.ts';

export const DeleteSkill = ({
  deleting,
  data,
  working,
  setDeleting,
  error,
  remove,
}: SkillsViewModel) => {
  if (!deleting) return null;
  return (
    <Modal
      title={`Delete ${deleting.name}`}
      className="skills-delete-dialog"
      onClose={() => {
        if (!working) setDeleting(null);
      }}
    >
      <p>
        {assignment(deleting, data.roles)} will stop using it in future runs. Active runs keep their
        current skills.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="skills-dialog-actions">
        <Button className="button" disabled={working} onClick={() => setDeleting(null)}>
          Cancel
        </Button>
        <Button className="button danger" disabled={working} onClick={() => void remove()}>
          Delete skill
        </Button>
      </div>
    </Modal>
  );
};
