import type { ComposerSuggestion } from '@/ChatComposer/types.ts';
import { useImperativeHandle, useRef, useState, type RefObject } from 'react';
import type { ChatComposerProps } from '../types.ts';
import { chatAttachmentAccept } from '@pitchcrew/core/chat-attachments';
import { Button } from '@pitchcrew/design-system/button';
import { DropdownMenu, DropdownMenuTrigger } from '@pitchcrew/design-system/dropdown-menu';
import { Plus } from 'lucide-react';
import { ComposerContextItems } from './ComposerContextItems.tsx';
import { ComposerJobPicker } from './ComposerJobPicker.tsx';
import { ComposerDelegatePicker } from './ComposerDelegatePicker.tsx';

export const ComposerAttachmentMenu = (
  props: ChatComposerProps & {
    contextActions?: RefObject<
      ((action: NonNullable<ComposerSuggestion['action']>) => void) | null
    >;
  },
) => {
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [choosingJob, setChoosingJob] = useState(false);
  const [delegating, setDelegating] = useState(false);
  const jobLocked = props.busy || !!props.messages.length;
  const canDelegate = !props.readOnly && props.available && !props.working;
  useImperativeHandle(
    props.contextActions,
    () => (action) => {
      if (action === 'attach' && props.available) input.current?.click();
      if (action === 'job' && !jobLocked && !props.working) setChoosingJob(true);
      if (action === 'delegate' && canDelegate) setDelegating(true);
    },
    [props.available, props.working, jobLocked, canDelegate],
  );
  return (
    <>
      <input
        ref={input}
        type="file"
        className="hidden"
        aria-label="Choose chat attachments"
        multiple
        accept={chatAttachmentAccept}
        disabled={!props.available}
        onChange={(event) => {
          props.addFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={trigger}
          render={
            <Button
              variant="ghost"
              size="sm"
              className="chat-add-context"
              disabled={!props.available}
            />
          }
          aria-label="Add context"
        >
          <Plus size={16} /> <span>Add context</span>
        </DropdownMenuTrigger>
        <ComposerContextItems
          attached={!!props.attached}
          available={props.available}
          jobLocked={jobLocked || props.working}
          canDelegate={canDelegate}
          onFiles={() => input.current?.click()}
          onJob={() => setChoosingJob(true)}
          onDelegate={() => setDelegating(true)}
        />
      </DropdownMenu>
      {choosingJob ? (
        <ComposerJobPicker {...props} returnFocus={trigger} onClose={() => setChoosingJob(false)} />
      ) : null}
      {delegating ? (
        <ComposerDelegatePicker
          {...props}
          returnFocus={trigger}
          onClose={() => setDelegating(false)}
        />
      ) : null}
    </>
  );
};
