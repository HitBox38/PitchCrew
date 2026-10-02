import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import type { SkillsToolbarProps } from '@/SkillsView/types.ts';
import { Plus, Search } from 'lucide-react';

export function SkillsToolbar({
  query,
  setQuery,
  setStarter,
  setEditing,
  working,
}: SkillsToolbarProps) {
  return (
    <div className="skills-toolbar">
      <div className="search-input">
        <Search size={15} />
        <Input
          aria-label="Search skills"
          placeholder="Search skills"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="skill-actions">
        <Button
          className="button"
          onClick={() => {
            setStarter(null);
            setEditing('import');
          }}
          disabled={working}
        >
          Import from skills.sh
        </Button>
        <Button className="button primary" onClick={() => setEditing('new')} disabled={working}>
          <Plus size={16} /> Add skill
        </Button>
      </div>
    </div>
  );
}
