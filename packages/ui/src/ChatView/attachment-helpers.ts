import { chatAttachmentLimits, chatAttachmentMime } from '@pitchcrew/core/chat-attachments';

export function validateAttachments(files: readonly Pick<File, 'name' | 'size'>[]) {
  if (files.length > chatAttachmentLimits.count) return 'Attach up to five files per message.';
  const unsupported = files.find((file) => !chatAttachmentMime(file.name));
  if (unsupported)
    return `Choose text, PDF, DOCX, PNG, JPEG, WebP or GIF files. ${unsupported.name} is not supported.`;
  if (files.reduce((sum, file) => sum + file.size, 0) > chatAttachmentLimits.bytes)
    return 'Attachments must total 10 MB or less.';
  return '';
}

export function attachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
