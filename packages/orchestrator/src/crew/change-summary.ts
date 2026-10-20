import type { Packet, RunResult } from '@pitchcrew/core';

const documents = {
  resume: 'resume',
  coverLetter: 'cover letter',
  formAnswers: 'form answers',
  note: 'application note',
  claims: 'source claims',
} as const;

/** Keep activity concise without copying whole drafts or private runtime output. */
export function changeSummary(result: RunResult, previous: Packet | null): string {
  if (result.changeSummary) return result.changeSummary;
  if (result.role === 'scout')
    return oneLineChangeSummary(
      `Set fit score to ${result.fit}/100${result.reasons[0] ? `; ${result.reasons[0]}` : ''}`,
    );
  if (result.role === 'reviewer')
    return oneLineChangeSummary(
      result.feedback.find((text) => text.trim()) ??
        result.suggestions?.find((text) => text.trim()) ??
        'Checked the packet against job requirements and profile evidence',
    );
  const changed = (Object.keys(documents) as (keyof Packet)[]).filter(
    (key) => !previous || JSON.stringify(previous[key]) !== JSON.stringify(result.packet[key]),
  );
  return changed.length
    ? `${previous ? 'Updated' : 'Created'} ${changed.map((key) => documents[key]).join(', ')}`
    : 'Checked the existing packet; document contents are unchanged';
}

export function oneLineChangeSummary(text: string): string {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  return normalized.length > 300 ? `${normalized.slice(0, 299).trimEnd()}…` : normalized;
}
