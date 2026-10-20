import type { Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { EmptyState } from '@/components/EmptyState/index.tsx';
import { Plus } from 'lucide-react';
import { WorkspaceHeaderActions } from '@/App/components/WorkspacePage.tsx';
import { useRoutinesPage } from '../hooks/useRoutinesPage.ts';
import { RoutineRow } from './RoutineRow.tsx';
import { RoutineDialogs } from './RoutineDialogs.tsx';
import { RoutinesToolbar } from './RoutinesToolbar.tsx';

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
  return (
    <section aria-label="Routines and scheduled actions" className="routines-workspace">
      <WorkspaceHeaderActions>
        <Button className="button primary" onClick={() => controller.setEditing('new')}>
          <Plus size={16} /> New routine
        </Button>
      </WorkspaceHeaderActions>
      <RoutinesToolbar controller={controller} roles={data.roles} />
      <div className="routines-list-area">
        {controller.error && !controller.deleting ? (
          <p role="alert" className="form-error">
            {controller.error}
          </p>
        ) : null}
        {controller.routines.length ? (
          <ul className="routines-list">
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
                : 'Create a routine for recurring check-ins, application reviews or a one-time reminder. Choose an agent, a task and when to run it.'
            }
          >
            {!data.routines.length ? (
              <Button className="button" onClick={() => controller.setEditing('new')}>
                <Plus size={15} /> New routine
              </Button>
            ) : null}
          </EmptyState>
        )}
      </div>
      <RoutineDialogs controller={controller} data={data} action={action} working={working} />
    </section>
  );
};
