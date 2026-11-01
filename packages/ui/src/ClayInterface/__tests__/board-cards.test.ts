import { describe, expect, it } from 'vitest';
import type { Card, Run, Snapshot } from '@pitchcrew/core';
import { cardLine } from '../jobs.ts';

const card = (fields: Partial<Card>) =>
  ({ id: 'card-1', state: 'in_review', location: 'Remote', ...fields }) as Card;
const data = {
  roles: [
    { id: 'writer', name: 'Writer', enabled: true, workflowSeat: 'writer' },
    { id: 'reviewer', name: 'Reviewer', enabled: true, workflowSeat: 'reviewer' },
  ],
} as unknown as Snapshot;

describe('board card status line', () => {
  it('shows live agent activity only for a real run', () => {
    const run = { roleId: 'reviewer', activity: [], message: 'Checking claims' } as unknown as Run;
    expect(cardLine(card({}), { run }, data)).toEqual({
      text: 'Reviewer · Checking claims',
      tone: 'working',
    });
  });

  it('names the wait while nothing runs instead of implying an agent works', () => {
    expect(cardLine(card({}), {}, data).text).toBe('Ready for Reviewer');
    expect(cardLine(card({ state: 'agreed' }), {}, data).text).toBe('Ready for your approval');
    expect(cardLine(card({ state: 'changes_requested' }), {}, data).text).toBe(
      'Changes requested · Writer next',
    );
  });

  it('keeps location for leads and the recorded status after applying', () => {
    expect(cardLine(card({ state: 'lead' }), {}, data).text).toBe('Remote');
    expect(cardLine(card({ state: 'interviewing' }), {}, data).text).toBe('Interviewing');
  });
});
