import { WorkspaceHeaderActions, WorkspaceHeaderPrimary } from '@/App/components/WorkspacePage.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { availableSkillUpdates } from '@/lib/skill-updates.ts';
import type { SkillsViewModel } from '@/SkillsView/types.ts';
import { Plus, Search } from 'lucide-react';
import { SkillAgentSelect } from './SkillAgentSelect.tsx';

/** Title-row controls (the shell supplies the skill count): search, agent filter, Updates only, Import and Add skill. */
export const SkillsToolbar = (c: SkillsViewModel) => {
  return (
    <>
      <WorkspaceHeaderActions>
        <div className="skills-search">
          <Search size={14} aria-hidden="true" />
          <Input
            aria-label="Search skills"
            placeholder="Search skills"
            value={c.query}
            onChange={(e) => c.setQuery(e.target.value)}
          />
        </div>
        <SkillAgentSelect {...c} />
        {availableSkillUpdates(c.data).length || c.updatesOnly ? (
          <Button
            className="button skills-updates-toggle"
            aria-pressed={c.updatesOnly}
            onClick={c.onUpdatesOnly}
          >
            Updates only
          </Button>
        ) : null}
        <Button className="button" onClick={() => c.setEditing('import')} disabled={c.working}>
          <span>
            Import<span className="skills-import-long"> from skills.sh</span>
          </span>
        </Button>
      </WorkspaceHeaderActions>
      <WorkspaceHeaderPrimary>
        <Button className="button primary" onClick={() => c.setEditing('new')} disabled={c.working}>
          <Plus size={16} aria-hidden="true" /> Add skill
        </Button>
      </WorkspaceHeaderPrimary>
    </>
  );
};
