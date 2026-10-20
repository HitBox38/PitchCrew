import type { Role } from '@pitchcrew/core';
import { CalendarClock, Search } from 'lucide-react';
import { FormSelect } from '@/FormSelect/index.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import type { useRoutinesPage } from '../hooks/useRoutinesPage.ts';

export const RoutinesToolbar = ({
  controller,
  roles,
}: {
  controller: ReturnType<typeof useRoutinesPage>;
  roles: Role[];
}) => {
  return (
    <div className="routines-toolbar">
      <div className="form grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="routines-search">
          <span className="sr-only">Search routines</span>
          <Search size={16} aria-hidden="true" />
          <Input
            className="pl-9"
            type="search"
            placeholder="Search routines…"
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
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="quiet flex items-center gap-2">
          <CalendarClock size={15} aria-hidden="true" className="shrink-0" />
          Runs while Pitchcrew is open. One overdue run is picked up after downtime.
        </p>
        <span className="quiet shrink-0" aria-live="polite">
          {controller.routines.length} {controller.routines.length === 1 ? 'routine' : 'routines'}
        </span>
      </div>
    </div>
  );
};
