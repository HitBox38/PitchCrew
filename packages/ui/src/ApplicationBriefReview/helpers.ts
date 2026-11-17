import type { ExtractedJob } from '@pitchcrew/core';
import type { ContextResponse } from './types.ts';
export const emptyBrief = (): ExtractedJob => ({
  brief: { companyContext: '', responsibilities: [], qualifications: [], constraints: [] },
  requirements: [],
  flagged: [],
});
/** Use the same server baseline for initialization, cancellation and dirty checks. */
export const briefFromContext = (loaded: ContextResponse): ExtractedJob =>
  loaded.context
    ? {
        brief: loaded.context.brief,
        requirements: loaded.context.requirements,
        flagged: loaded.context.flagged,
        form: loaded.form ?? loaded.context.form,
      }
    : { ...emptyBrief(), flagged: loaded.flagged, form: loaded.form ?? undefined };
export const splitLines = (text: string) => text.split('\n');
export const normalizedBrief = (draft: ExtractedJob): ExtractedJob => ({
  ...draft,
  brief: {
    ...draft.brief,
    responsibilities: draft.brief.responsibilities.map((line) => line.trim()).filter(Boolean),
    qualifications: draft.brief.qualifications.map((line) => line.trim()).filter(Boolean),
    constraints: draft.brief.constraints.map((line) => line.trim()).filter(Boolean),
  },
});
/**
 * Why the brief cannot be confirmed yet, or '' when it can. The inline action and the job
 * footer share this so both name the same blocker; the daemon still validates the request.
 */
export const briefConfirmationBlocker = ({
  loaded,
  draft,
  busy,
  linked,
}: {
  loaded: ContextResponse | null;
  draft: ExtractedJob;
  busy: boolean;
  linked: boolean;
}) => {
  if (!loaded) return 'Loading the application brief…';
  if (busy) return 'Wait for this job’s active work to finish before confirming.';
  if (linked && !draft.form)
    return 'Inspect the application form, or choose to check it yourself, before confirming.';
  return '';
};

type InspectedForm = Extract<NonNullable<ExtractedJob['form']>, { status: 'inspected' }>;
export type InspectedField = InspectedForm['fields'][number];
// Plain names for the HTML control types an inspection records.
const fieldKinds: Record<string, string> = {
  text: 'Short answer',
  search: 'Short answer',
  textarea: 'Long answer',
  email: 'Email',
  tel: 'Phone number',
  url: 'Link',
  number: 'Number',
  date: 'Date',
  month: 'Month',
  time: 'Time',
  'datetime-local': 'Date and time',
  file: 'File',
  select: 'Choice',
  'select-one': 'Choice',
  radio: 'Choice',
  'select-multiple': 'Multiple choice',
  checkbox: 'Checkbox',
};
export const fieldKind = ({ type }: InspectedField) =>
  fieldKinds[type] ?? (type ? type[0].toUpperCase() + type.slice(1) : 'Field');
export const fieldName = (field: InspectedField, index: number) =>
  field.label || `Unlabeled field ${index + 1}`;
const mimeNames: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'text/plain': 'TXT',
};
/** `.pdf,.doc,application/pdf` → "PDF or DOC"; an empty accept list names no format. */
export const acceptedFiles = (accept: string) => {
  const names = [
    ...new Set(
      accept
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
        .map((item) =>
          item.startsWith('.')
            ? item.slice(1).toUpperCase()
            : (mimeNames[item] ?? (item.endsWith('/*') ? `any ${item.slice(0, -2)}` : item)),
        ),
    ),
  ];
  if (!names.length) return 'No format listed';
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
};
/** What an inspection asks of the user, ahead of the reference list of every field. */
export const formFindings = (form: InspectedForm) => {
  const named = form.fields.map((field, index) => ({
    field,
    name: fieldName(field, index),
    index,
  }));
  return {
    required: form.fields.filter((field) => field.required).length,
    missing: named.filter(({ field }) => field.missingAnswer),
    files: named.filter(({ field }) => field.type === 'file'),
    // A field already listed as needing an answer carries its limit there instead.
    limits: named.filter(({ field }) => field.maxLength !== undefined && !field.missingAnswer),
    // Hidden, disabled or unassessed controls may change; they are never described as ready.
    uncertain: form.fields.filter((field) => !field.visible || field.disabled || !field.assessed)
      .length,
  };
};
export const pageName = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** The intro only frames a brief being checked or edited; a confirmed brief just shows itself. */
export const briefIntro = (state: { editing: boolean; confirmed: boolean; extracted: boolean }) => {
  if (state.editing && state.confirmed)
    return 'Changes need another confirmation and packet review.';
  return state.editing || (state.extracted && !state.confirmed)
    ? 'Check it against the posting: Pitchcrew can’t tell if its saved copy is complete.'
    : '';
};

/**
 * Compare opens from the brief's tools row, often below the fold; the sticky posting can't rise
 * above its own section, so the section scrolls to its top and both columns start together.
 */
export const revealComparison = (target: EventTarget | null) => {
  const section = target instanceof Element ? target.closest('.brief-compare') : null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(() =>
    section?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }),
  );
};
