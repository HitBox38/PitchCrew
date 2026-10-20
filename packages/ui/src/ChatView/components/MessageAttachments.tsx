import type { ChatMessage } from '@pitchcrew/core';
import { Download, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { Attachment } from '@/components/ui/attachment/components/Attachment.tsx';
import { AttachmentMedia } from '@/components/ui/attachment/components/AttachmentMedia.tsx';
import { AttachmentContent } from '@/components/ui/attachment/components/AttachmentContent.tsx';
import { AttachmentTitle } from '@/components/ui/attachment/components/AttachmentTitle.tsx';
import { AttachmentDescription } from '@/components/ui/attachment/components/AttachmentDescription.tsx';
import { AttachmentActions } from '@/components/ui/attachment/components/AttachmentActions.tsx';
import { AttachmentTrigger } from '@/components/ui/attachment/components/AttachmentTrigger.tsx';

import { attachmentSize } from '../attachment-helpers.ts';
import { downloadAttachment } from '../api.ts';

export const MessageAttachments = ({ message }: { message: ChatMessage }) => {
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const download = async (file: NonNullable<ChatMessage['attachments']>[number]) => {
    setError('');
    setDownloading(true);
    try {
      await downloadAttachment(message.id, file);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not download this attachment.');
    } finally {
      setDownloading(false);
    }
  };
  if (!message.attachments?.length) return null;
  return (
    <div className="mt-2">
      <ul className="flex flex-wrap gap-2" aria-label="Message attachments">
        {message.attachments.map((file) => (
          <li key={file.id} className="max-w-full min-w-0">
            <Attachment size="sm">
              <AttachmentMedia>
                <Paperclip size={13} />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle title={file.name}>{file.name}</AttachmentTitle>
                <AttachmentDescription>{attachmentSize(file.size)}</AttachmentDescription>
              </AttachmentContent>
              <AttachmentTrigger
                disabled={downloading}
                aria-label={`Download ${file.name}`}
                onClick={() => void download(file)}
              />
              <AttachmentActions className="pointer-events-none">
                <Download size={13} aria-hidden="true" />
              </AttachmentActions>
            </Attachment>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </div>
  );
};
