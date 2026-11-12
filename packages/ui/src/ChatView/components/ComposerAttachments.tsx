import { keyedItems } from '@/lib/list-keys.ts';
import { Paperclip, X } from 'lucide-react';
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
} from '@pitchcrew/design-system/attachment';

import { attachmentSize } from '../attachment-helpers.ts';

export const ComposerAttachments = ({
  files,
  removeFile,
  disabled,
}: {
  files: File[];
  removeFile: (index: number) => void;
  disabled: boolean;
}) => {
  if (!files.length) return null;
  return (
    <ul aria-label="Files to attach" className="chat-composer-files flex w-full flex-wrap gap-2">
      {keyedItems(files, (file) =>
        JSON.stringify([file.name, file.size, file.type, file.lastModified]),
      ).map(({ item: file, key }, index) => (
        <li key={key} className="max-w-full min-w-0">
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
};
