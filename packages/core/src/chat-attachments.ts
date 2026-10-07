/** Browser-safe attachment policy shared by the composer and daemon. */
export const chatAttachmentLimits = { count: 5, bytes: 10 * 1024 * 1024, text: 50_000 } as const;
export const chatAttachmentTypes: Readonly<Record<string, string>> = {
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};
export const chatAttachmentAccept = Object.keys(chatAttachmentTypes)
  .map((type) => `.${type}`)
  .join(',');
export function chatAttachmentMime(name: string): string | undefined {
  if (
    !name ||
    name.length > 180 ||
    new TextEncoder().encode(name).length > 240 ||
    /[/\\<>:"|?*]/.test(name) ||
    [...name].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    /[. ]$/.test(name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(name)
  )
    return undefined;
  const extension = name.split('.').at(-1)?.toLowerCase() ?? '';
  return Object.hasOwn(chatAttachmentTypes, extension) ? chatAttachmentTypes[extension] : undefined;
}
export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
}
export interface ChatAttachmentUpload {
  name: string;
  data: string;
}
