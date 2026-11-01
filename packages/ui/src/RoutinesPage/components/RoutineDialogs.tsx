import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { Action } from '@/WorkspaceStore/types.ts';
import type { Snapshot } from '@pitchcrew/core';
import type { useRoutinesPage } from '../hooks/useRoutinesPage.ts';
import { RoutineEditor } from './RoutineEditor.tsx';

export const RoutineDialogs = ({
  controller,
  data,
  action,
  working,
}: {
  controller: ReturnType<typeof useRoutinesPage>;
  data: Snapshot;
  action: Action;
  working: boolean;
}) => {
  const { editing, deleting } = controller;
  return (
    <>
      {editing ? (
        <RoutineEditor
          key={editing === 'new' ? 'new' : editing.id}
          routine={editing === 'new' ? null : editing}
          roles={data.roles}
          cards={data.cards}
          action={action}
          working={working}
          onClose={() => controller.setEditing(null)}
          onDelete={editing === 'new' ? undefined : () => controller.setDeleting(editing)}
        />
      ) : null}
      {deleting ? (
        <Modal
          title="Delete routine"
          className="routine-delete"
          onClose={() => {
            if (!working) controller.setDeleting(null);
          }}
        >
          <p>
            Delete <strong>{deleting.name}</strong>? Future runs stop. A run already in progress
            continues, and its history is kept.
          </p>
          {controller.error ? (
            <p role="alert" className="form-error">
              {controller.error}
            </p>
          ) : null}
          <div className="routine-delete-footer">
            <Button
              variant="outline"
              disabled={working}
              onClick={() => controller.setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={working}
              onClick={() => void controller.remove()}
            >
              Delete routine
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
};
