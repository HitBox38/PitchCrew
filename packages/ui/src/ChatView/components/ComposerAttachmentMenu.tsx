import { useRef, useState } from 'react';
import type { ChatComposerProps } from '../types.ts';
import { chatAttachmentAccept } from '@pitchcrew/core/chat-attachments';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu/index.tsx';
import { Plus, Paperclip, BriefcaseBusiness } from 'lucide-react';
import { ComposerJobPicker } from './ComposerJobPicker.tsx';

export function ComposerAttachmentMenu(props: ChatComposerProps) {
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [choosingJob, setChoosingJob] = useState(false);
  const jobLocked = props.busy || !!props.messages.length;
  return (
    <>
      <input
        ref={input}
        type="file"
        className="hidden"
        aria-label="Choose chat attachments"
        multiple
        accept={chatAttachmentAccept}
        disabled={props.working || !props.available}
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
              disabled={props.working}
            />
          }
          aria-label="Add context"
        >
          <Plus size={16} /> <span>Add context</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64">
          <DropdownMenuItem onClick={() => input.current?.click()} disabled={!props.available}>
            <Paperclip />
            <span className="grid gap-0.5">
              <span>Add files…</span>
              <span className="text-xs text-muted-foreground">
                For this message · up to 5 files, 10 MB
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={jobLocked} onClick={() => setChoosingJob(true)}>
            <BriefcaseBusiness />
            <span className="grid gap-0.5">
              <span>{props.attached ? 'Change conversation job…' : 'Attach a job…'}</span>
              <span className="text-xs text-muted-foreground">
                {jobLocked ? 'Fixed after the first message' : 'For the whole conversation'}
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {choosingJob ? (
        <ComposerJobPicker {...props} returnFocus={trigger} onClose={() => setChoosingJob(false)} />
      ) : null}
    </>
  );
}
