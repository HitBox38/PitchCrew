import { describe, expect, it } from 'vitest';
import {
  acceptedFiles,
  briefConfirmationBlocker,
  emptyBrief,
  fieldKind,
  formFindings,
  pageName,
  type InspectedField,
} from '../helpers.ts';
import type { ContextResponse } from '../types.ts';

const loaded: ContextResponse = {
  sourceRevision: 'source-1',
  context: null,
  flagged: [],
  form: null,
  formCurrent: false,
};

describe('brief confirmation blocker', () => {
  it('waits for the brief and active work before anything else', () => {
    const draft = emptyBrief();
    expect(briefConfirmationBlocker({ loaded: null, draft, busy: false, linked: true })).toContain(
      'Loading',
    );
    expect(briefConfirmationBlocker({ loaded, draft, busy: true, linked: true })).toContain(
      'active work',
    );
  });

  it('names the explicit form choice for linked jobs and never makes it for the user', () => {
    const draft = emptyBrief();
    expect(briefConfirmationBlocker({ loaded, draft, busy: false, linked: true })).toBe(
      'Inspect the application form, or choose to check it yourself, before confirming.',
    );
    expect(draft.form).toBeUndefined();
    expect(
      briefConfirmationBlocker({
        loaded,
        draft: { ...draft, form: { status: 'manual' } },
        busy: false,
        linked: true,
      }),
    ).toBe('');
  });

  it('leaves unlinked jobs and missing personal answers to the daemon', () => {
    const draft = {
      ...emptyBrief(),
      requirements: [{ id: 'why', question: 'Why?', required: true, personal: true, answer: '' }],
    };
    expect(briefConfirmationBlocker({ loaded, draft, busy: false, linked: false })).toBe('');
  });
});

const field = (patch: Partial<InspectedField>): InspectedField => ({
  label: 'Field',
  type: 'text',
  required: false,
  visible: true,
  disabled: false,
  accept: '',
  options: [],
  assessed: true,
  condition: '',
  missingAnswer: '',
  ...patch,
});

describe('inspected form summary', () => {
  it('names controls and file formats in plain words', () => {
    expect(fieldKind(field({ type: 'textarea' }))).toBe('Long answer');
    expect(fieldKind(field({ type: 'tel' }))).toBe('Phone number');
    expect(fieldKind(field({ type: 'color' }))).toBe('Color');
    expect(acceptedFiles('.pdf,.doc, .docx')).toBe('PDF, DOC or DOCX');
    expect(acceptedFiles('.pdf,application/pdf')).toBe('PDF');
    expect(acceptedFiles('image/*')).toBe('any image');
    expect(acceptedFiles('')).toBe('No format listed');
    expect(pageName('https://example.com/apply/')).toBe('example.com/apply');
  });

  it('pulls out what the user prepares and never counts uncertain controls as checked', () => {
    const found = formFindings({
      status: 'inspected',
      url: 'https://example.com/apply',
      fields: [
        field({ label: 'Resume', type: 'file', required: true, accept: '.pdf' }),
        field({ label: 'Why us?', type: 'textarea', maxLength: 500, missingAnswer: 'Motivation' }),
        field({ label: '', visible: false }),
        field({ label: 'Notes', assessed: false }),
        field({ label: 'Summary', type: 'textarea', maxLength: 300 }),
      ],
      blockers: [],
      uninspected: [],
    });
    expect(found.required).toBe(1);
    expect(found.files.map((item) => item.name)).toEqual(['Resume']);
    expect(found.missing.map((item) => item.name)).toEqual(['Why us?']);
    // A field the user owes an answer to carries its limit there, so it isn't listed twice.
    expect(found.limits.map((item) => item.name)).toEqual(['Summary']);
    expect(found.uncertain).toBe(2);
  });
});
