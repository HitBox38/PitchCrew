import type { Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { Button } from '@pitchcrew/design-system/button';
import { useRoutinesPage } from '../hooks/useRoutinesPage.ts';
import { RoutineRow } from './RoutineRow.tsx';
import { RoutineDialogs } from './RoutineDialogs.tsx';
import { RoutinesTitle } from './RoutinesTitle.tsx';
import { RoutineAvailability } from './RoutineAvailability.tsx';

export const RoutinesWorkspace = ({
  data,
  action,
  working,
}: {
  data: Snapshot;
  action: Action;
  working: boolean;
}) => {
  const controller = useRoutinesPage(data, action);
  const filtered = controller.query || controller.filter !== 'all';
  return (
    <section aria-label="Routines and scheduled actions" className="routines-page">
      <RoutinesTitle controller={controller} roles={data.roles} routines={data.routines} />
      <div className="routines-list-area">
        {controller.error && !controller.deleting ? (
          <p role="alert" className="form-error">
            {controller.error}
          </p>
        ) : null}
        {controller.routines.length ? (
          <>
            <ul className="routines-list" aria-label="Routines">
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
            <p className="routines-list-note">
              <RoutineAvailability />
            </p>
          </>
        ) : data.routines.length && filtered ? (
          <p className="ui-empty">
            No routines match these filters.
            <Button variant="ghost" size="sm" onClick={controller.clearFilters}>
              Clear filters
            </Button>
          </p>
        ) : (
          <p className="ui-empty routines-empty">
            No routines scheduled.
            <RoutineAvailability />
          </p>
        )}
      </div>
      <RoutineDialogs controller={controller} data={data} action={action} working={working} />
    </section>
  );
};
