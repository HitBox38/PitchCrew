import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import type { SkillImportProps } from '@/SkillsView/components/SkillEditor/types.ts';
import { BookOpen, LoaderCircle } from 'lucide-react';

export function SkillImport({
  url,
  setUrl,
  loading,
  working,
  loadSkill,
  skill,
  starter,
}: SkillImportProps) {
  return (
    <section className="role-settings-section" aria-labelledby="skill-import-heading">
      <h3 id="skill-import-heading">Import from skills.sh</h3>
      <label htmlFor="skill-url">Skill URL</label>
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
        {loading ? <LoaderCircle className="spin" size={15} /> : <BookOpen size={15} />}{' '}
        {skill ? 'Load latest instructions' : 'Load skill'}
      </Button>
      <p className="quiet">
        Imports public GitHub-backed SKILL.md instructions. Supporting scripts and files are not
        included. Review the instructions before adding them to your crew.
      </p>
      {starter?.note ? <p className="quiet">{starter.note}</p> : null}
    </section>
  );
}
