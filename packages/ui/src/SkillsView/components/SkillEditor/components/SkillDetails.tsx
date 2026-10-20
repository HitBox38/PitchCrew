import { Input } from '@/components/ui/input/components/Input.tsx';
import type { SkillDetailsProps } from '@/SkillsView/components/SkillEditor/types.ts';

export const SkillDetails = ({
  source,
  importing,
  creator,
  name,
  setName,
  description,
  setDescription,
}: SkillDetailsProps) => {
  return (
    <section className="role-settings-section" aria-label="Skill details">
      {source || !importing ? (
        <p className="quiet">Made by {source?.repository.split('/')[0] ?? creator}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-4 max-phone:grid-cols-1">
        <label htmlFor="skill-name" className="grid min-w-0 gap-2">
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
        <label htmlFor="skill-description" className="grid min-w-0 gap-2">
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
    </section>
  );
};
