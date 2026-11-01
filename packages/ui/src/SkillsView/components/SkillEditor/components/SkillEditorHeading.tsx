import { MarkdownModeTabs } from '@/components/MarkdownEditor/components/MarkdownModeTabs.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { SkillEditorModel } from '../types.ts';
import { ArrowLeft } from 'lucide-react';

export const SkillEditorHeading = (c: SkillEditorModel & { onBack: () => void }) => {
  return (
    <header className="skills-pane-head skills-editor-head">
      <Button
        className="icon-button skills-back"
        aria-label="Back to skills"
        disabled={c.working}
        onClick={c.onBack}
      >
        <ArrowLeft size={16} />
      </Button>
      <div className="skills-pane-title">
        <h2>
          {c.skill ? `Edit ${c.skill.name}` : c.importing ? 'Import from skills.sh' : 'Add skill'}
        </h2>
        {c.source || !c.importing ? (
          <p>Made by {c.source?.repository.split('/')[0] ?? c.creator}</p>
        ) : null}
      </div>
      <div className="skills-pane-actions">
        <MarkdownModeTabs label="Skill editor mode" />
      </div>
    </header>
  );
};
