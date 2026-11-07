import type { ChatRequest } from '@pitchcrew/core';
import { Paperclip } from 'lucide-react';
import { attachmentSize } from '../attachment-helpers.ts';

export const SavedQueueAttachments = ({ files }: { files: ChatRequest['attachments'] }) =>
  files.length ? (
    <div className="chat-queued-saved-files">
      <p>Saved attachments</p>
      <ul aria-label="Saved attachments">
        {files.map((file) => (
          <li key={file.id}>
            <Paperclip size={13} aria-hidden="true" />
            <span>{file.name}</span>
            <small>{attachmentSize(file.size)}</small>
          </li>
        ))}
      </ul>
    </div>
  ) : null;
