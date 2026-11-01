import type { Role, Routine } from '@pitchcrew/core';
import { Plus, Search } from 'lucide-react';
import {
  WorkspaceHeaderActions,
  WorkspaceHeaderFact,
  WorkspaceHeaderPrimary,
} from '@/App/components/WorkspacePage.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { Input } from '@pitchcrew/design-system/input';
import { FormSelect } from '@/FormSelect/index.tsx';
import type { useRoutinesPage } from '../hooks/useRoutinesPage.ts';
import { routinesFact } from '../schedule-preview.ts';

/** Title-row fact, scoped search, agent filter and the page's one primary action. */
export const RoutinesTitle = ({
  controller,
  roles,
  routines,
}: {
  controller: ReturnType<typeof useRoutinesPage>;
  roles: Role[];
  routines: Routine[];
}) => (
  <>
    <WorkspaceHeaderFact>{routinesFact(routines)}</WorkspaceHeaderFact>
    <WorkspaceHeaderActions>
      <label className="routines-search">
        <Search size={15} aria-hidden="true" />
        <Input
          type="search"
          aria-label="Search routines"
          placeholder="Search routines"
          value={controller.query}
          onChange={(event) => controller.setQuery(event.target.value)}
        />
      </label>
      <FormSelect
        className="routines-agent-filter"
        label="Filter by agent"
        value={controller.filter}
        onValueChange={controller.setFilter}
        options={[
          { value: 'all', label: 'All agents' },
          ...roles.map((role) => ({ value: role.id, label: role.name })),
        ]}
      />
    </WorkspaceHeaderActions>
    <WorkspaceHeaderPrimary>
      <Button data-routine-focus="new" onClick={() => controller.setEditing('new')}>
        <Plus size={16} /> New routine
      </Button>
    </WorkspaceHeaderPrimary>
  </>
);
