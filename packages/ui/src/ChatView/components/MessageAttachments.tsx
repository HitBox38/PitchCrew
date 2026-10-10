import type { ChatMessage } from '@pitchcrew/core';
import { Download, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { attachmentSize } from '../attachment-helpers.ts';
import { downloadAttachment } from '../api.ts';

export function MessageAttachments({ message }: { message: ChatMessage }) {
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
            <Button
              variant="outline"
              size="sm"
              className="max-w-full"
              disabled={downloading}
              aria-label={`Download ${file.name}`}
              onClick={() => void download(file)}
            >
              <Paperclip size={13} />
              <span className="min-w-0 truncate" title={file.name}>
                {file.name}
              </span>
              <span className="shrink-0 text-muted-foreground">{attachmentSize(file.size)}</span>
              <Download size={13} />
            </Button>
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
}
