import type { JobLookupDuplicate, JobLookupPrefill } from '@pitchcrew/core';
import { stateLabels } from '../../lib/labels.ts';

const prefillFieldNames = [
  'company',
  'title',
  'location',
  'url',
  'salary',
  'description',
  'jobIdentifier',
] as const;
/** The form fields a fetched posting fills, by input name. */
export function prefillFields(prefill: JobLookupPrefill): Record<string, string> {
  return Object.fromEntries(prefillFieldNames.map((name) => [name, prefill[name]]));
}
interface FormLike {
  elements: { namedItem(name: string): unknown };
}
/** Capture values before a lookup starts so its result can retain intervening edits. */
export function snapshotJobForm(form: FormLike): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of prefillFieldNames) {
    const field = form.elements.namedItem(name);
    if (field && typeof field === 'object' && 'value' in field && typeof field.value === 'string')
      values[name] = field.value;
  }
  return values;
}
/**
 * Write fetched values into the uncontrolled form for review. Empty values keep what the user
 * already typed. An empty value clears an unchanged value from the previously fetched posting.
 * Values edited while the lookup was pending are preserved, including deliberate empty values.
 */
export function fillJobForm(
  form: FormLike,
  prefill: JobLookupPrefill,
  previous: JobLookupPrefill | null = null,
  initial?: Record<string, string>,
) {
  const prior = previous ? prefillFields(previous) : {};
  for (const [name, value] of Object.entries(prefillFields(prefill))) {
    const field = form.elements.namedItem(name);
    if (field && typeof field === 'object' && 'value' in field) {
      const input = field as { value: string };
      if (initial && input.value !== (initial[name] ?? '')) continue;
      if (value || (prior[name] && input.value === prior[name])) input.value = value;
    }
  }
}
/** Send link provenance only while the URL field still holds the fetched posting URL. */
export function provenanceFor(prefill: JobLookupPrefill | null, url: string) {
  return prefill && url.trim() === prefill.url ? prefill.provenance : undefined;
}
export function duplicateText(card: JobLookupDuplicate): string {
  return `${card.company}: ${card.title} (${stateLabels[card.state]})`;
}
