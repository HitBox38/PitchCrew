import type { PacketArtifact } from '@pitchcrew/core';

export type ArtifactPages = Record<string, number> | undefined;

// PDF counts come from the frozen bytes. DOCX counts are the formatted layout's estimate.
export function pageLabel(artifact: PacketArtifact, pages: ArtifactPages) {
  const count = pages?.[artifact.digest];
  if (count === undefined) return undefined;
  const label = `${count} ${count === 1 ? 'page' : 'pages'}`;
  return artifact.mimeType === 'application/pdf' ? label : `about ${label} in Word`;
}

export function resumePageWarning(artifacts: PacketArtifact[], pages: ArtifactPages) {
  const counts = artifacts
    .filter((artifact) => artifact.source === 'resume')
    .map((artifact) => pages?.[artifact.digest] ?? 0);
  const most = Math.max(0, ...counts);
  return most > 1
    ? `The resume runs to ${most} pages. The target is one page. Reject and ask the Writer to shorten it, or approve if you want a longer resume.`
    : undefined;
}
