import { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import { chatAttachmentAccept } from '@pitchcrew/core/chat-attachments';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { attachmentSize } from '../attachment-helpers.ts';
import { PromptInputHeader } from '@/components/ai-elements/prompt-input/components/PromptInputHeader.tsx';

export function ComposerAttachments({
  files,
  addFiles,
  removeFile,
  disabled,
}: {
  files: File[];
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <PromptInputHeader className="items-stretch px-3 pt-2">
      <input
        ref={input}
        type="file"
        className="hidden"
        aria-label="Choose chat attachments"
        multiple
        accept={chatAttachmentAccept}
        disabled={disabled}
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Attach files"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          <Paperclip size={14} /> Attach files
        </Button>
        <span className="text-detail text-muted-foreground">Up to 5 files · 10 MB total</span>
      </div>
      {files.length ? (
        <ul aria-label="Files to attach" className="mt-2 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex max-w-full items-center gap-1 rounded-md border bg-muted px-2 py-1 text-detail"
            >
              <Paperclip size={12} className="shrink-0" />
              <span className="min-w-0 truncate" title={file.name}>
                {file.name}
              </span>
              <span className="shrink-0 text-muted-foreground">{attachmentSize(file.size)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => removeFile(index)}
              >
                <X size={12} />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </PromptInputHeader>
  );
}
