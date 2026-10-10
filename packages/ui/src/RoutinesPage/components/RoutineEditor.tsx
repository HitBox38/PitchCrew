import { RoutineConversation } from './RoutineConversation.tsx';
import { Modal } from '@/components/Modal/index.tsx';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { useRoutineEditor } from '../hooks/useRoutineEditor.ts';
import type { EditorProps } from '../types.ts';
import { ActionFields } from './ActionFields.tsx';
import { ScheduleFields } from './ScheduleFields.tsx';

export function RoutineEditor(props: EditorProps) {
  const editor = useRoutineEditor(props);
  return (
    <Modal
      title={props.routine ? 'Edit routine' : 'New routine'}
      onClose={editor.close}
      className="flex max-h-[90dvh] flex-col overflow-hidden"
    >
      <form
        className="form flex min-h-0 flex-col gap-5"
        onSubmit={(event) => void editor.save(event)}
      >
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
          <ActionFields {...editor} roles={props.roles} cards={props.cards} />
          <RoutineConversation {...editor} />
          <ScheduleFields {...editor} />
          <p className="quiet">
            Times use the timezone above. Runs continue in the routine’s conversation. Exports and
            browser actions still need your approval.
          </p>
          {props.routine ? (
            <p className="quiet">
              {props.routine.runCount} runs already dispatched. Editing keeps this count; run limits
              apply to the total.
            </p>
          ) : null}
          {editor.error ? (
            <p role="alert" className="form-error">
              {editor.error}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border pt-4">
          <Button className="button" disabled={props.working} onClick={editor.close}>
            Cancel
          </Button>
          <Button type="submit" className="button primary" disabled={props.working}>
            Save routine
          </Button>
        </div>
      </form>
      <DiscardChanges guard={editor.guard} />
    </Modal>
  );
}
