/** Ids stored on approvals and selected by agent tools. Export files use a person's name. */
export const packetFileIds = {
  resume: { md: 'resume.md', pdf: 'resume.pdf', docx: 'resume.docx' },
  coverLetter: { md: 'cover_letter.md', pdf: 'cover_letter.pdf', docx: 'cover_letter.docx' },
} as const;

export type PacketDocumentKind = keyof typeof packetFileIds;
export type PacketFileFormat = 'md' | 'pdf' | 'docx';

const tokens = { resume: 'CV', coverLetter: 'Cover_Letter' } as const;

const plain = (text: string) =>
  text
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

// shortcut: the filename uses the resume's first heading, not a separate name field.
const resumeHeading = (resume: string) => {
  const lines = resume.replace(/^\uFEFF/, '').split(/\r?\n/);
  let start = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)\s*$/.test(line));
    const first = lines.slice(1, end).find((line) => line.trim());
    if (end > 0 && (first === undefined || /^\s*([\w-]+\s*:|#)/.test(first))) start = end + 1;
  }
  for (let index = start; index < lines.length; index++) {
    const line = lines[index] ?? '';
    const atx = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (atx) {
      const text = plain(atx[1] ?? '');
      if (text) return text;
      continue;
    }
    if (!line.trim()) continue;
    if (/^ {0,3}=+[ \t]*$/.test(lines[index + 1] ?? '')) {
      const text = plain(line);
      if (text) return text;
    }
    return '';
  }
  return '';
};

/** "Ada Lovelace" → "Ada_Lovelace". Empty when the heading is not a usable filename. */
export const packetNameStem = (fullName: string) => {
  const stem = [
    ...fullName
      .normalize('NFC')
      .replace(/\u00A0/g, ' ')
      .replace(/[^\p{L}\p{N}\p{M}\u200C\u200D\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/^-+|-+$/g, ''),
  ]
    .slice(0, 60)
    .join('');
  return /\p{L}|\p{N}/u.test(stem) ? stem : '';
};

export const packetFileName = (
  resume: string,
  kind: PacketDocumentKind,
  format: PacketFileFormat,
) => {
  const stem = packetNameStem(resumeHeading(resume));
  return stem ? `${stem}_${tokens[kind]}.${format}` : packetFileIds[kind][format];
};

const canonicalFile = (name: string) => {
  for (const kind of ['resume', 'coverLetter'] as const)
    for (const format of ['md', 'pdf', 'docx'] as const)
      if (packetFileIds[kind][format] === name) return { kind, format };
  return undefined;
};

/** Download, export and upload name for a canonical packet file id. Other names stay as given. */
export const packetExportFileName = (resume: string, canonical: string) => {
  const parsed = canonicalFile(canonical);
  return parsed ? packetFileName(resume, parsed.kind, parsed.format) : canonical;
};

/** The name an export used before headings were included, when it differs from the current name. */
export const legacyExportFileName = (name: string) => {
  const cv = /^(.+)_CV\.(md|pdf|docx)$/.exec(name);
  if (cv?.[2]) return packetFileIds.resume[cv[2] as PacketFileFormat];
  const letter = /^(.+)_Cover_Letter\.(md|pdf|docx)$/.exec(name);
  if (letter?.[2]) return packetFileIds.coverLetter[letter[2] as PacketFileFormat];
  return undefined;
};
