import type {
  Card,
  DetectorAdvisory,
  DetectorDocument,
  DetectorProvider,
  DetectorStatus,
} from '@pitchcrew/core';

/** Mirrors core's threshold; only type imports of core are allowed here. */
export const flagThreshold = 0.5;
export const documentLabels: Record<DetectorDocument, string> = {
  coverLetter: 'Cover letter',
  formAnswers: 'Form answers',
};
export const providerNames: Record<DetectorProvider, string> = {
  sapling: 'Sapling',
  copyleaks: 'Copyleaks',
  gptzero: 'GPTZero',
  originality: 'Originality.ai',
};
export type Digests = Partial<Record<DetectorDocument, string>>;
export interface AdvisoryRow {
  advisory: DetectorAdvisory;
  /** The checked text no longer matches the current document. */
  outdated: boolean;
  tone: 'flagged' | 'clear' | 'low';
}
export interface DocumentRow {
  document: DetectorDocument;
  label: string;
  text: string;
  advisories: AdvisoryRow[];
}

export const advisoryTone = (advisory: DetectorAdvisory): AdvisoryRow['tone'] =>
  advisory.confidence === 'low' ? 'low' : advisory.score >= flagThreshold ? 'flagged' : 'clear';

/** One row per non-empty eligible document; resumes stay out of detector scope. */
export const detectorRows = (card: Card, digests: Digests): DocumentRow[] => {
  if (!card.packet) return [];
  const packet = card.packet;
  return (['coverLetter', 'formAnswers'] as const)
    .filter((document) => packet[document].trim())
    .map((document) => ({
      document,
      label: documentLabels[document],
      text: packet[document],
      advisories: (card.detectorAdvisories ?? [])
        .filter((advisory) => advisory.document === document)
        .map((advisory) => ({
          advisory,
          outdated: !!digests[document] && digests[document] !== advisory.documentDigest,
          tone: advisoryTone(advisory),
        })),
    }));
};
export const configuredProviders = (statuses: DetectorStatus[] | undefined) =>
  (statuses ?? []).filter((status) => status.configured).map((status) => status.provider);

export const scoreLabel = (row: AdvisoryRow) => {
  const percent = Math.round(row.advisory.score * 100);
  const base =
    row.tone === 'low'
      ? `${providerNames[row.advisory.provider]}: low confidence, ${percent}% flagged`
      : row.tone === 'flagged'
        ? `${providerNames[row.advisory.provider]} flagged ${percent}%`
        : `${providerNames[row.advisory.provider]}: ${percent}% flagged`;
  return row.outdated ? `${base} (outdated)` : base;
};
/** The flagged passages, longest first, for the Writer draft; never the whole document. */
export const flaggedExcerpts = (row: AdvisoryRow, text: string, limit = 3) =>
  row.advisory.passages
    .filter((passage) => passage.score >= flagThreshold)
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, limit)
    .map((passage) => text.slice(passage.start, passage.end).trim())
    .filter(Boolean);
export const revisionDraft = (row: AdvisoryRow, label: string, text: string) => {
  const excerpts = flaggedExcerpts(row, text);
  const quoted = excerpts.length
    ? `\n\nFlagged passages:\n${excerpts.map((excerpt) => `> ${excerpt}`).join('\n')}`
    : '';
  return `Revise for the AI-text detector advisory on the ${label.toLowerCase()}: ${providerNames[row.advisory.provider]} flagged ${Math.round(row.advisory.score * 100)}% of it. Make the flagged passages clearer and more specific using supported details only; keep every exact Profile quotation and qualification, and do not invent motivations or experiences.${quoted}`;
};
