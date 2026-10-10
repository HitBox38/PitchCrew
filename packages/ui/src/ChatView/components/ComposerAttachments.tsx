import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { attachmentSize } from '../attachment-helpers.ts';

export function ComposerAttachments({
  files,
  removeFile,
  disabled,
}: {
  files: File[];
  removeFile: (index: number) => void;
  disabled: boolean;
}) {
  if (!files.length) return null;
  return (
    <ul aria-label="Files to attach" className="flex w-full flex-wrap gap-2">
      {files.map((file, index) => (
        <li key={`${file.name}-${index}`} className="chat-context-chip">
          <Paperclip size={12} className="shrink-0" />
          <span className="min-w-0 truncate" title={file.name}>
            {file.name}
          </span>
          <span className="shrink-0 text-muted-foreground">{attachmentSize(file.size)}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Remove ${file.name}`}
            disabled={disabled}
            onClick={() => removeFile(index)}
          >
            <X size={12} />
          </Button>
        </li>
      ))}
    </ul>
  );
}
