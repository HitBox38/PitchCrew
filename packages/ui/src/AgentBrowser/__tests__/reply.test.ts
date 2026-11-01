import { describe, expect, it } from 'vitest';
import type { ChatReference } from '@pitchcrew/core';
import { remapReferences, replyCopy } from '../reply.ts';

const reference = (token: string, start: number): ChatReference => ({
  kind: token.startsWith('@') ? 'agent' : 'skill',
  id: token.slice(1),
  label: token.slice(1),
  token,
  start,
  end: start + token.length,
});

describe('clay expanded browser message box', () => {
  const draft = 'Ask @scout about $tailor';
  const scout = reference('@scout', 4);
  const skill = reference('$tailor', 17);

  it('keeps chips before an edit and shifts chips after it', () => {
    const after = 'Please ask @scout about $tailor';
    expect(remapReferences(draft, draft, [scout, skill])).toEqual([scout, skill]);
    expect(remapReferences(draft, after, [scout, skill])).toEqual([
      { ...scout, start: 11, end: 17 },
      { ...skill, start: 24, end: 31 },
    ]);
    expect(remapReferences(draft, `${draft} now`, [scout, skill])).toEqual([scout, skill]);
  });

  it('drops chips the edit touches and clears all on send', () => {
    expect(remapReferences(draft, 'Ask @scot about $tailor', [scout, skill])).toEqual([
      { ...skill, start: 16, end: 23 },
    ]);
    expect(remapReferences(draft, '', [scout, skill])).toEqual([]);
  });

  it('says what sending does while the agent works and which chat files it includes', () => {
    const status = {
      hasInput: false,
      busy: true,
      busyElsewhere: false,
      sendMode: 'queue' as const,
      running: ['Submitter'],
      asking: [],
    };
    expect(replyCopy({ group: false, name: 'Submitter', files: 0, status })).toEqual({
      label: 'Message Submitter',
      note: 'Sends after Submitter finishes',
    });
    expect(
      replyCopy({
        group: true,
        name: 'Submitter',
        files: 2,
        status: { ...status, sendMode: 'interrupt' },
      }),
    ).toEqual({
      label: 'Message the group',
      note: 'Interrupts Submitter · Includes 2 files attached in chat',
    });
    expect(
      replyCopy({ group: false, name: 'Submitter', files: 0, status: { ...status, busy: false } })
        .note,
    ).toBe('');
  });
});
