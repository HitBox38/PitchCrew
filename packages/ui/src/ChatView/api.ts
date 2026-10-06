import type { ChatAttachment, ChatAttachmentUpload } from '@pitchcrew/core';

export function encodeAttachment(file: File): Promise<ChatAttachmentUpload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ name: file.name, data: String(reader.result).split(',')[1] ?? '' });
    reader.onerror = () =>
      reject(new Error(`Could not read ${file.name}. Please select it again.`));
    reader.onabort = () => reject(new Error('File reading was cancelled.'));
    reader.readAsDataURL(file);
  });
}

export async function downloadAttachment(messageId: string, file: ChatAttachment) {
  const response = await fetch(`/api/chat/messages/${messageId}/attachments/${file.id}`, {
    headers: { 'x-pitchcrew-client': 'ui' },
  });
  if (!response.ok) throw new Error('Could not download this attachment.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
