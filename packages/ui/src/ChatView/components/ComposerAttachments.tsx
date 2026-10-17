import { Paperclip, X } from 'lucide-react';
import { Attachment } from '@/components/ui/attachment/components/Attachment.tsx';
import { AttachmentMedia } from '@/components/ui/attachment/components/AttachmentMedia.tsx';
import { AttachmentContent } from '@/components/ui/attachment/components/AttachmentContent.tsx';
import { AttachmentTitle } from '@/components/ui/attachment/components/AttachmentTitle.tsx';
import { AttachmentDescription } from '@/components/ui/attachment/components/AttachmentDescription.tsx';
import { AttachmentActions } from '@/components/ui/attachment/components/AttachmentActions.tsx';
import { AttachmentAction } from '@/components/ui/attachment/components/AttachmentAction.tsx';

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
        <li key={`${file.name}-${index}`} className="max-w-full min-w-0">
          <Attachment size="sm" className="chat-context-chip">
            <AttachmentMedia>
              <Paperclip size={12} />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle title={file.name}>{file.name}</AttachmentTitle>
              <AttachmentDescription>{attachmentSize(file.size)}</AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => removeFile(index)}
              >
                <X size={12} />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
        </li>
      ))}
    </ul>
  );
}
