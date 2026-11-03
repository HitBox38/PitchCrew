import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { MarkdownEditor } from '@/components/MarkdownEditor/index.tsx';
import { useMarkdownSaveShortcut } from '@/components/MarkdownEditor/hooks/useMarkdownSaveShortcut.ts';
import { Tabs } from '@pitchcrew/design-system/tabs';
import { skillContentLimit } from '@pitchcrew/core/base-skills';
import { SkillAssignment } from './components/SkillAssignment.tsx';
import { SkillDetails } from './components/SkillDetails.tsx';
import { SkillDelivery } from './components/SkillDelivery.tsx';
import { SkillEditorFooter } from './components/SkillEditorFooter.tsx';
import { SkillEditorHeading } from './components/SkillEditorHeading.tsx';
import { SkillImport } from './components/SkillImport.tsx';
import { useSkillEditor } from './hooks/useSkillEditor.ts';
import type { SkillEditorProps } from './types.ts';

/** Add, import and edit share one in-pane lifecycle: fields, Write | Preview sheet, save bar. */
export const SkillEditor = (props: SkillEditorProps) => {
  const form = useMarkdownSaveShortcut();
  const c = useSkillEditor(props);
  return (
    <>
      <Tabs value={c.mode} onValueChange={c.setMode} className="skills-pane skills-editor">
        <form
          ref={form}
          className="skills-editor-form"
          aria-label={c.skill ? `Edit ${c.skill.name}` : 'New skill'}
          onSubmit={(event) => void c.save(event)}
        >
          <SkillEditorHeading
            {...c}
            onBack={() =>
              c.guard.requestLeave(() => {
                props.onClose();
                props.onBack();
              })
            }
          />
          <div className="skills-editor-fields">
            {c.importing ? <SkillImport {...c} /> : null}
            <SkillDetails {...c} />
            <SkillAssignment {...c} />
            <SkillDelivery {...c} />
          </div>
          <div className="skills-sheet">
            <MarkdownEditor
              id="skill-content"
              label="Skill Markdown"
              content={c.content}
              onChange={c.setContent}
              maxLength={skillContentLimit}
              disabled={c.working || c.loading}
              placeholder={
                '# Clear application writing\n\nUse when drafting an application.\n\n- Lead with relevant experience.\n- Support every claim with a profile quotation.'
              }
            />
          </div>
          <SkillEditorFooter {...c} />
        </form>
      </Tabs>
      <DiscardChanges guard={c.guard} />
    </>
  );
};
