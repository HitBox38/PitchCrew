import { diagnosticRequestHeaders } from '../Analytics/request-context.ts';
import { chatAttachmentMime } from '@pitchcrew/core/chat-attachments';
import { parseFileCitation } from '@pitchcrew/core/chat-citations';
import type { ViewerFile } from '@/FileViewer/types.ts';

export const loadCitationAttachment = async (
  url: string,
  signal: AbortSignal,
): Promise<ViewerFile> => {
  const target = parseFileCitation(url);
  if (target?.kind !== 'attachment') throw new Error('This file reference is unavailable.');
  const [messageId, fileId] = target.ids.map(encodeURIComponent);
  const response = await fetch(`/api/chat/messages/${messageId}/attachments/${fileId}`, {
    headers: { 'x-pitchcrew-client': 'ui', ...diagnosticRequestHeaders() },
    signal,
  });
  if (!response.ok) throw new Error('This attachment is no longer available.');
  const name = decodeURIComponent(
    response.headers.get('Content-Disposition')?.split("UTF-8''")[1] ?? '',
  );
  const mimeType = chatAttachmentMime(name);
  if (!mimeType) throw new Error('This attachment cannot be previewed.');
  const blob = await response.blob();
  const kind =
    mimeType === 'application/pdf'
      ? 'pdf'
      : mimeType.includes('wordprocessingml')
        ? 'docx'
        : mimeType.startsWith('image/')
          ? 'image'
          : mimeType === 'text/markdown'
            ? 'markdown'
            : 'text';
  const binary = ['pdf', 'docx', 'image'].includes(kind);
  const bytes = binary
    ? await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('Could not read this attachment.'));
        reader.readAsDataURL(blob);
      })
    : undefined;
  return {
    id: url,
    name,
    kind,
    mimeType,
    bytes,
    text: binary ? undefined : await blob.text(),
    downloadAllowed: true,
  };
};
