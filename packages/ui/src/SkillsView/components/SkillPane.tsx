import type { SkillsViewModel } from '@/SkillsView/types.ts';
import { skillEditorKey } from '../helpers.ts';
import { SkillDocument } from './SkillDocument.tsx';
import { SkillEditor } from './SkillEditor/index.tsx';
import { SkillPaneEmpty } from './SkillPaneEmpty.tsx';

/** The reading/editing pane beside the library. Editing replaces the document in place. */
export const SkillPane = (c: SkillsViewModel) => {
  const { editing, starter, filter } = c;
  if (editing)
    return (
      <SkillEditor
        key={skillEditorKey(editing, starter)}
        skill={typeof editing === 'string' ? null : editing}
        creator={typeof editing === 'string' ? 'You' : c.creator(editing)}
        importing={editing === 'import'}
        starter={editing === 'import' ? starter : null}
        roles={c.data.roles}
        initialRole={filter !== 'all' && filter !== 'shared' ? filter : null}
        action={c.action}
        working={c.working}
        registerLeave={c.registerLeave}
        onClose={c.closeEditor}
        onSaved={c.onSaved}
        onBack={() => c.setSelectedId(null)}
      />
    );
  if (c.selected) return <SkillDocument {...c} />;
  return <SkillPaneEmpty {...c} />;
};
