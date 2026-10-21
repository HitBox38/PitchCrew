import { skillEditorKey } from '../helpers.ts';
import { DeleteSkill } from './DeleteSkill.tsx';
import { SkillEditor } from '@/SkillsView/components/SkillEditor/index.tsx';
import type { SkillDialogsProps } from '@/SkillsView/types.ts';
import { AnimatePresence } from 'motion/react';

export const SkillDialogs = ({
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
}: SkillDialogsProps) => {
  return (
    <AnimatePresence>
      {editing ? (
        <SkillEditor
          key={skillEditorKey(editing, starter)}
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
        <DeleteSkill
          key="delete-skill"
          deleting={deleting}
          data={data}
          working={working}
          setDeleting={setDeleting}
          error={error}
          remove={remove}
        />
      ) : null}
    </AnimatePresence>
  );
};
