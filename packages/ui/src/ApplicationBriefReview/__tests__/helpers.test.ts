import { describe, expect, it } from 'vitest';
import { briefConfirmationBlocker, emptyBrief } from '../helpers.ts';
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
