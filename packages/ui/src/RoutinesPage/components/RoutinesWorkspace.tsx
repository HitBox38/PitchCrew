import type { Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { EmptyState } from '@/components/EmptyState/index.tsx';
import { CalendarClock, Plus } from 'lucide-react';
import { useRoutinesPage } from '../hooks/useRoutinesPage.ts';
import { RoutineRow } from './RoutineRow.tsx';
import { RoutineDialogs } from './RoutineDialogs.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import { Input } from '@/components/ui/input/index.tsx';

export function RoutinesWorkspace({
  data,
  action,
  working,
}: {
  data: Snapshot;
  action: Action;
  working: boolean;
}) {
  const controller = useRoutinesPage(data, action);
  return (
    <section aria-label="Routines and scheduled actions" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="quiet flex items-center gap-2">
          <CalendarClock size={18} /> Runs while Pitchcrew is open. One overdue run is picked up
          after downtime.
        </p>
        <Button className="button primary" onClick={() => controller.setEditing('new')}>
          <Plus size={16} /> New routine
        </Button>
      </div>
      <div className="form grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <label>
          Search routines
          <Input
            aria-label="Search routines"
            type="search"
            placeholder="Search routines…"
            value={controller.query}
            onChange={(event) => controller.setQuery(event.target.value)}
          />
        </label>
        <FormSelect
          label="Filter by agent"
          value={controller.filter}
          onValueChange={controller.setFilter}
          options={[
            { value: 'all', label: 'All agents' },
            ...data.roles.map((role) => ({ value: role.id, label: role.name })),
          ]}
        />
      </div>
      {controller.error && !controller.deleting ? (
        <p role="alert" className="form-error">
          {controller.error}
        </p>
      ) : null}
      {controller.routines.length ? (
        <ul>
          {controller.routines.map((routine) => (
            <RoutineRow
              key={routine.id}
              routine={routine}
              data={data}
              working={working}
              edit={() => controller.setEditing(routine)}
              toggle={() => void controller.toggle(routine)}
              remove={() => controller.setDeleting(routine)}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          title={data.routines.length ? 'No matching routines' : 'Put a task on the calendar'}
          description={
            data.routines.length
              ? 'Try another search or agent.'
              : 'Ask an agent “Every weekday at 9, review my applications for two weeks”, or create a routine here.'
          }
        />
      )}
      <RoutineDialogs controller={controller} data={data} action={action} working={working} />
    </section>
  );
}
