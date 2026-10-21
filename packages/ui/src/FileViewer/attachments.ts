import type { ApprovalRequest } from '@/components/InboxView/types.ts';
import type { ViewerFile } from './types.ts';
const sourceNames = {
  resume: 'resume.md',
  coverLetter: 'cover_letter.md',
  formAnswers: 'form_answers.md',
  note: 'note.md',
} as const;
export const attachmentFiles = (
  request: ApprovalRequest,
  pages?: Record<string, number>,
): ViewerFile[] => {
  if (request.kind === 'browser') {
    const browser = request.approval;
    return [
      ...(browser.page.screenshot
        ? [
            {
              id: 'screenshot',
              name: 'captured-page.jpg',
              kind: 'image' as const,
              mimeType: 'image/jpeg',
              bytes: browser.page.screenshot,
              downloadAllowed: true,
            },
          ]
        : []),
      {
        id: 'page-text',
        name: 'captured-page.txt',
        kind: 'text',
        mimeType: 'text/plain',
        text: browser.page.text,
        downloadAllowed: true,
      },
      ...(browser.uploadPreview
        ? [
            {
              id: 'upload-preview',
              name: 'upload-preview.txt',
              kind: 'text' as const,
              mimeType: 'text/plain',
              text: browser.uploadPreview,
              downloadAllowed: true,
            },
          ]
        : []),
      ...(browser.uploadContent !== undefined
        ? [
            {
              id: 'upload-content',
              name: 'upload-content.txt',
              kind: 'text' as const,
              mimeType: 'text/plain',
              text: browser.uploadContent,
              downloadAllowed: true,
            },
          ]
        : []),
    ];
  }
  const packet = request.approval;
  const downloadAllowed = packet.status === 'consumed' && !!packet.exportDirectory;
  return [
    ...(packet.artifacts ?? []).map((artifact): ViewerFile => ({
      id: artifact.digest,
      name: artifact.name,
      kind: artifact.mimeType === 'application/pdf' ? 'pdf' : 'docx',
      mimeType: artifact.mimeType,
      bytes: artifact.bytes,
      text: packet.packet[artifact.source],
      downloadAllowed,
      pages: pages?.[artifact.digest],
      findings: (
        packet.documentVerification?.find((report) => report.name === artifact.name) ??
        artifact.verification
      )?.findings,
    })),
    ...Object.entries(sourceNames).map(([source, name]): ViewerFile => ({
      id: name,
      name,
      kind: 'markdown',
      mimeType: 'text/markdown;charset=utf-8',
      text: packet.packet[source as keyof typeof sourceNames],
      downloadAllowed,
    })),
  ];
};
export const fileSize = (file: ViewerFile) => {
  const bytes = file.bytes
    ? Math.floor((file.bytes.length * 3) / 4) -
      (file.bytes.endsWith('==') ? 2 : file.bytes.endsWith('=') ? 1 : 0)
    : new TextEncoder().encode(file.text ?? '').length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
};
export const downloadFile = (file: ViewerFile) => {
  if (!file.downloadAllowed)
    throw new Error('Choose a submission method to export this packet first.');
  const contents = file.bytes
    ? Uint8Array.from(atob(file.bytes), (character) => character.charCodeAt(0))
    : (file.text ?? '');
  const url = URL.createObjectURL(new Blob([contents], { type: file.mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
