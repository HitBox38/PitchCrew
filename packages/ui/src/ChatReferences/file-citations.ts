import { packetSourceNames, parseFileCitation } from '@pitchcrew/core/chat-citations';
import type { ReferenceCatalog } from './types.ts';
import type { ViewerFile } from '@/FileViewer/types.ts';

export const citationFile = (url: string, catalog: ReferenceCatalog): ViewerFile | undefined => {
  const target = parseFileCitation(url);
  if (!target || target.kind === 'attachment') return;
  const [id, name] = target.ids;
  if (target.kind === 'profile') {
    const file = catalog.profile?.find((file) => file.name === id);
    if (file)
      return {
        id: url,
        name: file.name,
        kind: 'markdown',
        mimeType: 'text/markdown',
        text: file.content,
        downloadAllowed: true,
      };
    return;
  }
  const approval = catalog.approvals?.find((approval) => approval.id === id);
  if (!approval) return;
  const downloadAllowed = approval.status === 'consumed' && !!approval.exportDirectory;
  const artifact = approval.artifacts?.find((file) => file.name === name);
  if (artifact)
    return {
      id: url,
      name: artifact.name,
      kind: artifact.mimeType === 'application/pdf' ? 'pdf' : 'docx',
      mimeType: artifact.mimeType,
      bytes: artifact.bytes,
      text: approval.packet[artifact.source],
      downloadAllowed,
      findings: (
        approval.documentVerification?.find((report) => report.name === artifact.name) ??
        artifact.verification
      )?.findings,
    };
  const source = Object.entries(packetSourceNames).find(([, file]) => file === name)?.[0] as
    | keyof typeof packetSourceNames
    | undefined;
  if (source)
    return {
      id: url,
      name: name!,
      kind: 'markdown',
      mimeType: 'text/markdown',
      text: approval.packet[source],
      downloadAllowed,
    };
};
