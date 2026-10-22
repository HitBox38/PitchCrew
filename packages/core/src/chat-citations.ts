import type { Approval, ProfileFile } from './workspace.ts';
import type { ChatMessage } from './chat.ts';

export interface ChatFileCitation {
  name: string;
  url: string;
}
export const fileCitationUrl = (kind: 'attachment' | 'profile' | 'packet', ...ids: string[]) =>
  `pitchcrew-file:${kind}/${ids.map(encodeURIComponent).join('/')}`;

export const parseFileCitation = (url: string) => {
  const match = /^pitchcrew-file:(attachment|profile|packet)\/([^?#]+)$/.exec(url);
  if (!match) return null;
  try {
    const ids = match[2]!.split('/').map(decodeURIComponent);
    if (
      ids.some((id) => !id || /[/\\]/.test(id) || [...id].some((char) => char.charCodeAt(0) < 32))
    )
      return null;
    const kind = match[1] as 'attachment' | 'profile' | 'packet';
    return ids.length === (kind === 'profile' ? 1 : 2) ? { kind, ids } : null;
  } catch {
    return null;
  }
};

export const packetSourceNames = {
  resume: 'resume.md',
  coverLetter: 'cover_letter.md',
  formAnswers: 'form_answers.md',
  note: 'note.md',
} as const;

/** Cite saved identities, never ambient filesystem paths or a mutable current packet. */
export const chatFileCitations = (
  messages: ChatMessage[],
  profile: ProfileFile[],
  approvals: Approval[] = [],
): ChatFileCitation[] => [
  ...messages.flatMap((message) =>
    (message.attachments ?? []).map((file) => ({
      name: file.name,
      url: fileCitationUrl('attachment', message.id, file.id),
    })),
  ),
  ...profile.map((file) => ({ name: file.name, url: fileCitationUrl('profile', file.name) })),
  ...approvals.flatMap((approval) =>
    [
      ...Object.values(packetSourceNames),
      ...(approval.artifacts ?? []).map((file) => file.name),
    ].map((name) => ({ name, url: fileCitationUrl('packet', approval.id, name) })),
  ),
];
