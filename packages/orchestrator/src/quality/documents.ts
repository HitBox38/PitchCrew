import { prepareVerifiedArtifacts, systemFonts } from '@pitchcrew/packet';
import type { Packet } from '@pitchcrew/core';
import { join } from 'node:path';

export async function inspectPacketDocuments(directory: string, packet: Packet) {
  const { reports } = await prepareVerifiedArtifacts(packet, ['pdf'], 'formatted', {
    fonts: systemFonts({ folders: [join(directory, 'fonts')] }),
  });
  for (const source of ['resume', 'coverLetter'] as const) {
    const name = source === 'resume' ? 'resume.pdf' : 'cover_letter.pdf';
    if (reports.find((r) => r.name === name)?.status === 'blocked') {
      const fallback = await prepareVerifiedArtifacts(packet, ['docx'], 'formatted', {
        sources: [source],
        fonts: systemFonts({ folders: [join(directory, 'fonts')] }),
      });
      reports.push(...fallback.reports);
    }
  }
  const errors: string[] = [];
  const warnings: string[] = [];
  const repairable: string[] = [];
  for (const source of ['resume', 'cover_letter']) {
    const files = reports.filter((r) => r.name.startsWith(`${source}.`));
    const valid = files.some((r) => r.status === 'verified');
    for (const report of files)
      for (const finding of report.findings) {
        const message = `${report.name}${finding.page ? ` page ${finding.page}` : ''}: ${finding.message}`;
        if (!valid && finding.severity === 'error') errors.push(message);
        else warnings.push(message);
        if (
          report.name.endsWith('.pdf') &&
          report.status === 'verified' &&
          finding.check === 'layout'
        )
          repairable.push(message);
      }
  }
  return { reports, errors, warnings, repairable };
}
