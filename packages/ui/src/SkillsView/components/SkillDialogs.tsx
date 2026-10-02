import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { SkillEditor } from '@/SkillsView/components/SkillEditor/index.tsx';
import { assignment } from '@/SkillsView/helpers.ts';
import type { SkillDialogsProps } from '@/SkillsView/types.ts';
import { Trash2 } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

export function SkillDialogs({
  editing,
  starter,
  creator,
  data,
  filter,
  action,
  working,
  setEditing,
  deleting,
  setDeleting,
  error,
  remove,
}: SkillDialogsProps) {
  return (
    <AnimatePresence>
      {editing ? (
        <SkillEditor
          key={
            typeof editing === 'string'
              ? editing === 'import'
                ? (starter?.name ?? editing)
                : editing
              : editing.id
          }
          skill={typeof editing === 'string' ? null : editing}
          creator={typeof editing === 'string' ? 'You' : creator(editing)}
          importing={editing === 'import'}
          starter={editing === 'import' ? starter : null}
          roles={data.roles}
          initialRole={filter !== 'all' && filter !== 'shared' ? filter : null}
          action={action}
          working={working}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <Modal
          key="delete-skill"
          title="Delete skill"
          onClose={() => {
            if (!working) setDeleting(null);
          }}
        >
          <p>
            Delete <strong>{deleting.name}</strong> for {assignment(deleting, data.roles)}? Future
            runs will stop using it. Active runs keep their current skills.
          </p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="form-footer">
            <Button className="button" disabled={working} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button className="button danger" disabled={working} onClick={() => void remove()}>
              <Trash2 size={15} /> Delete skill
            </Button>
          </div>
        </Modal>
      ) : null}
    </AnimatePresence>
  );
}
