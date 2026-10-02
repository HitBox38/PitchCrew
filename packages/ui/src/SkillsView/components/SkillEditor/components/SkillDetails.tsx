import { Input } from '@/components/ui/input/components/Input.tsx';
import type { SkillDetailsProps } from '@/SkillsView/components/SkillEditor/types.ts';

export function SkillDetails({
  source,
  importing,
  creator,
  name,
  setName,
  description,
  setDescription,
}: SkillDetailsProps) {
  return (
    <section className="role-settings-section" aria-label="Skill details">
      {source || !importing ? (
        <p className="quiet">Made by {source?.repository.split('/')[0] ?? creator}</p>
      ) : null}
      <label htmlFor="skill-name">Name</label>
      <Input
        id="skill-name"
        required
        maxLength={80}
        placeholder="e.g. Clear application writing"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label htmlFor="skill-description">
        Description <span className="optional">optional</span>
      </label>
      <Input
        id="skill-description"
        maxLength={500}
        placeholder="When should an agent use this skill?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    </section>
  );
}
