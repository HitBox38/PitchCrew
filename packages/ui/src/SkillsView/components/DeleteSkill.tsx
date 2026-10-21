import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { assignment } from '../helpers.ts';
import type { SkillDialogsProps } from '../types.ts';
import { Trash2 } from 'lucide-react';

export const DeleteSkill = ({
  deleting,
  data,
  working,
  setDeleting,
  error,
  remove,
}: Pick<
  SkillDialogsProps,
  'deleting' | 'data' | 'working' | 'setDeleting' | 'error' | 'remove'
>) => {
  if (!deleting) return null;
  return (
    <Modal
      key="delete-skill"
      title="Delete skill"
      onClose={() => {
        if (!working) setDeleting(null);
      }}
    >
      <p>
        Delete <strong>{deleting.name}</strong> for {assignment(deleting, data.roles)}? Future runs
        will stop using it. Active runs keep their current skills.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="form-footer mt-0.5 flex justify-end gap-2.5 border-t border-border pt-4">
        <Button className="button" disabled={working} onClick={() => setDeleting(null)}>
          Cancel
        </Button>
        <Button className="button danger" disabled={working} onClick={() => void remove()}>
          <Trash2 size={15} /> Delete skill
        </Button>
      </div>
    </Modal>
  );
};
