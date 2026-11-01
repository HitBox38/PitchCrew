import { Input } from '@/components/ui/input/components/Input.tsx';
import type { SkillEditorModel } from '../types.ts';

export const SkillDetails = ({ name, setName, description, setDescription }: SkillEditorModel) => {
  return (
    <div className="skills-editor-details">
      <label htmlFor="skill-name" className="field">
        Name
        <Input
          id="skill-name"
          required
          maxLength={80}
          placeholder="e.g. Clear application writing"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label htmlFor="skill-description" className="field">
        <span>
          Description <span className="optional">optional</span>
        </span>
        <Input
          id="skill-description"
          maxLength={500}
          placeholder="When should an agent use this skill?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
    </div>
  );
};
