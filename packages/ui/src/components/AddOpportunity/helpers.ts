import type { JobLookupDuplicate, JobLookupPrefill } from '@pitchcrew/core';
import { stateLabels } from '../../lib/labels.ts';

/** The form fields a fetched posting fills, by input name. */
export function prefillFields(prefill: JobLookupPrefill): Record<string, string> {
  return {
    company: prefill.company,
    title: prefill.title,
    location: prefill.location,
    url: prefill.url,
    salary: prefill.salary,
    description: prefill.description,
    jobIdentifier: prefill.jobIdentifier,
  };
}
interface FormLike {
  elements: { namedItem(name: string): unknown };
}
/**
 * Write fetched values into the uncontrolled form for review. Empty values keep what the user
 * already typed, so a posting without a salary does not clear the salary field.
 */
export function fillJobForm(form: FormLike, prefill: JobLookupPrefill) {
  for (const [name, value] of Object.entries(prefillFields(prefill))) {
    const field = form.elements.namedItem(name);
    if (value && field && typeof field === 'object' && 'value' in field)
      (field as { value: string }).value = value;
  }
}
/** Send link provenance only while the URL field still holds the fetched posting URL. */
export function provenanceFor(prefill: JobLookupPrefill | null, url: string) {
  return prefill && url.trim() === prefill.url ? prefill.provenance : undefined;
}
export function duplicateText(card: JobLookupDuplicate): string {
  return `${card.company}: ${card.title} (${stateLabels[card.state]})`;
}
