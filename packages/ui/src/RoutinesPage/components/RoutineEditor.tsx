import { X } from 'lucide-react';
import { RoutineConversation } from './RoutineConversation.tsx';
import { SidePanel } from '@/components/SidePanel/index.tsx';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { useRoutineEditor } from '../hooks/useRoutineEditor.ts';
import type { EditorProps } from '../types.ts';
import { ActionFields } from './ActionFields.tsx';
import { ScheduleFields } from './ScheduleFields.tsx';
import { RoutineSummary } from './RoutineSummary.tsx';

/** A 480px non-modal side panel beside the list: Task, Schedule, computed next run, actions. */
export const RoutineEditor = (props: EditorProps) => {
  const editor = useRoutineEditor(props);
  const title = props.routine ? 'Edit routine' : 'New routine';
  return (
    <SidePanel
      className="routine-editor-panel"
      onClose={editor.close}
      returnFocus={`[data-routine-focus="${props.routine?.id ?? 'new'}"]`}
    >
      <form
        className="routine-editor"
        aria-label={title}
        onSubmit={(event) => void editor.save(event)}
      >
        <div className="routine-editor-heading">
          <h2>{title}</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close routine editor"
            disabled={props.working}
            onClick={editor.close}
          >
            <X size={16} />
          </Button>
        </div>
        <div className="routine-editor-body">
          <fieldset className="ui-field-group routine-group">
            <legend>Task</legend>
            <ActionFields {...editor} roles={props.roles} cards={props.cards} />
            <RoutineConversation {...editor} />
          </fieldset>
          <ScheduleFields {...editor} />
          <RoutineSummary draft={editor.draft} initial={editor.initial} routine={props.routine} />
          {editor.error ? (
            <p role="alert" className="form-error">
              {editor.error}
            </p>
          ) : null}
        </div>
        <div className="ui-footer-bar routine-editor-footer">
          {props.onDelete ? (
            <Button variant="destructive" disabled={props.working} onClick={props.onDelete}>
              Delete
            </Button>
          ) : null}
          <span className="routine-editor-spacer" />
          <Button variant="outline" disabled={props.working} onClick={editor.close}>
            Cancel
          </Button>
          <Button type="submit" disabled={props.working}>
            Save routine
          </Button>
        </div>
      </form>
      <DiscardChanges guard={editor.guard} />
    </SidePanel>
  );
};
