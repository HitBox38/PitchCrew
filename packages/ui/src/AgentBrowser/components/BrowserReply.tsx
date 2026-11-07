import { useId } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Textarea } from '@pitchcrew/design-system/textarea';
import { remapReferences, replyCopy } from '../reply.ts';
import type { BrowserReplyProps } from '../types.ts';
import { ComposerRecovery } from '@/ChatView/components/ComposerRecovery.tsx';

/** Clay expanded browser: a compact box that edits the conversation's shared draft and sends it
 * through the chat composer's send path, so typing here or in chat is the same message. */
export const BrowserReply = ({ name, ...props }: BrowserReplyProps & { name: string }) => {
  const noteId = useId();
  if (props.readOnly) return null;
  const roleName = (id: string) => props.data.roles.find((role) => role.id === id)?.name ?? id;
  const hasInput = !!props.draft.trim() || !!props.files.length;
  const { label, note } = replyCopy({
    group: props.participants.length > 1,
    name,
    files: props.files.length,
    status: {
      hasInput,
      busy: props.busy,
      busyElsewhere: props.busyElsewhere,
      sendMode: props.sendMode,
      running: props.running
        .filter((run) => !run.reviewSeatReservation)
        .map((run) => roleName(run.roleId)),
      asking: props.questions.map((question) => roleName(question.roleId)),
    },
  });
  const disabled = !props.available;
  const sendDisabled = disabled || props.working || props.sending;
  const submit = () => void props.send(props.draft, props.busy ? props.sendMode : 'queue');
  return (
    <form
      className="browser-reply"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {props.error ? (
        <p className="form-error" role="alert">
          {props.error}
        </p>
      ) : null}
      <ComposerRecovery thread={props.thread} />
      <div className="browser-reply-field">
        <Textarea
          rows={1}
          className="browser-reply-input"
          aria-label={label}
          aria-describedby={note ? noteId : undefined}
          placeholder={props.available ? label : `${name} can’t chat right now`}
          value={props.draft}
          disabled={disabled}
          onChange={(event) => {
            const text = event.target.value;
            props.changeDraft(text, remapReferences(props.draft, text, props.draftReferences));
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            submit();
          }}
        />
        <Button
          type="submit"
          size="icon-sm"
          variant={hasInput && !sendDisabled ? 'default' : 'ghost'}
          className="browser-reply-send"
          aria-label={props.busy && props.sendMode === 'queue' ? 'Queue follow-up' : 'Send message'}
          disabled={!hasInput || sendDisabled}
        >
          <ArrowUp size={15} aria-hidden="true" />
        </Button>
      </div>
      {note ? (
        <p id={noteId} className="browser-reply-note">
          {note}
        </p>
      ) : null}
    </form>
  );
};
