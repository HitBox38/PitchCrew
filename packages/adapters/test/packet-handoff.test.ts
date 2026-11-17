import type { RunContext } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { packetHandoffInstructions } from '../src/process/packet-handoff.ts';

it('tells an isolated Reviewer its result is the handoff and keeps tooling out of its summary', () => {
  // A real Reviewer once reported a missing board tool as a packet limitation in Decisions.
  const text = packetHandoffInstructions('reviewer', {} as RunContext);
  expect(text).toContain('the returned result is your board handoff');
  expect(text).toContain('never tools, permissions or Pitchcrew itself');
  // A real Reviewer once wrote "empty formAnswers" in changes shown to the user.
  expect(text).toContain('never result field names such as formAnswers');
  expect(packetHandoffInstructions('writer', {} as RunContext)).toContain('plain words');
  // A real Writer's notes once said "Submitter must inspect" and "packet lint check passes".
  expect(packetHandoffInstructions('writer', {} as RunContext)).toContain(
    'avoid internal workflow terms such as lint, Submitter',
  );
  // A real Reviewer's summary once said "registered claims" and "packet-rule issues".
  expect(text).toContain('registered claims, packet rules');
  expect(
    packetHandoffInstructions('reviewer', { purpose: 'packet-evaluation' } as RunContext),
  ).toBe('');
});

it('asks Scout for a plain leading reason and the extractor for plain constraints', async () => {
  const { promptFor } = await import('../src/process/prompts.ts');
  const { contextFor, cleanup } = await import('./helpers/runtime.ts');
  try {
    const context = await contextFor('opencode');
    // The job sheet leads Scout's notes with reasons[0], so it must read as the decision.
    expect(promptFor({ ...context, purpose: 'fit' })).toContain(
      'Make reasons[0] one plain sentence',
    );
    expect(promptFor({ ...context, purpose: 'source-extraction' })).toContain(
      'Write constraints and flagged reasons as short plain sentences',
    );
    expect(promptFor({ ...context, purpose: 'application-draft' })).not.toContain('reasons[0]');
  } finally {
    await cleanup();
  }
});
