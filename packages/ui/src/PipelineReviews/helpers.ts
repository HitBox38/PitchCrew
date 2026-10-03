import { stateLabels } from '@/lib/labels.ts';
import type { CardState } from '@pitchcrew/core';

export function evidenceDetails(summary: string): string[] {
  try {
    const data = JSON.parse(summary) as Record<string, unknown>;
    const lines: string[] = [];
    if (typeof data.state === 'string')
      lines.push(`Application state: ${stateLabels[data.state as CardState] ?? data.state}`);
    if (typeof data.status === 'string') lines.push(`Status: ${data.status}`);
    if (typeof data.effectiveAt === 'string')
      lines.push(`Effective date: ${new Date(data.effectiveAt).toLocaleString()}`);
    if (Array.isArray(data.feedback))
      lines.push(...data.feedback.filter((item): item is string => typeof item === 'string'));
    if (typeof data.processedCount === 'number')
      lines.push(`Messages assessed: ${data.processedCount}`);
    return lines;
  } catch {
    return [];
  }
}
