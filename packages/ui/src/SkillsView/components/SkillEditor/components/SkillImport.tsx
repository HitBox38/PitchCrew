import { Button } from '@pitchcrew/design-system/button';
import { Input } from '@pitchcrew/design-system/input';
import type { SkillEditorModel } from '../types.ts';
import { LoaderCircle } from 'lucide-react';

/** skills.sh source first; loading fills the fields and sheet for review before saving. */
export const SkillImport = ({
  url,
  setUrl,
  loading,
  working,
  loadSkill,
  skill,
  starter,
}: SkillEditorModel) => {
  return (
    <div className="skills-import">
      <label htmlFor="skill-url" className="field">
        skills.sh link
        <span className="skills-import-row">
          <Input
            id="skill-url"
            type="url"
            maxLength={500}
            placeholder="https://skills.sh/owner/repository/skill-name"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading || working}
          />
          <Button
            className="button"
            onClick={() => void loadSkill()}
            disabled={loading || working || !url.trim()}
          >
            {loading ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : null}
            {loading ? 'Loading…' : skill ? 'Load latest' : 'Load skill'}
          </Button>
        </span>
      </label>
      <p className="skills-import-note">
        Public GitHub-backed SKILL.md instructions only; scripts and other files aren’t included.
        {starter?.note ? ` ${starter.note}` : ''}
      </p>
    </div>
  );
};
