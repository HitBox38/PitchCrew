import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { Action } from '@/WorkspaceStore/types.ts';
import type { Snapshot } from '@pitchcrew/core';
import type { useRoutinesPage } from '../hooks/useRoutinesPage.ts';
import { RoutineEditor } from './RoutineEditor.tsx';

export function RoutineDialogs({
  controller,
  data,
  action,
  working,
}: {
  controller: ReturnType<typeof useRoutinesPage>;
  data: Snapshot;
  action: Action;
  working: boolean;
}) {
  return (
    <>
      {controller.editing ? (
        <RoutineEditor
          key={controller.editing === 'new' ? 'new' : controller.editing.id}
          routine={controller.editing === 'new' ? null : controller.editing}
          roles={data.roles}
          cards={data.cards}
          action={action}
          working={working}
          onClose={() => controller.setEditing(null)}
        />
      ) : null}
      {controller.deleting ? (
        <Modal
          title="Delete routine"
          onClose={() => {
            if (!working) controller.setDeleting(null);
          }}
        >
          <p>
            Delete <strong>{controller.deleting.name}</strong>? Future runs will stop. Any active
            run continues, and history is kept.
          </p>
          {controller.error ? (
            <p role="alert" className="form-error">
              {controller.error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              className="button"
              disabled={working}
              onClick={() => controller.setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              className="button danger"
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
}
