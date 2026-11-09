import { cardInput, runResultSchema, type Packet, type RunContext } from '@pitchcrew/core';
import { failureCategory } from '@pitchcrew/core/operational-logs';
import { originalReviewPerspectives } from '@pitchcrew/core/deep-review-labels';
import { describe, expect, it } from 'vitest';
import { parseWorkflowResult, promptFor } from '../src/process.ts';

const packet: Packet = {
  resume: 'Fictional resume',
  coverLetter: 'Fictional cover letter',
  formAnswers: '',
  note: '',
  claims: [
    { claim: 'Built café interfaces.', source: 'profile.md', quote: 'Built café interfaces.' },
  ],
};
const context = (roleId: string, fields: Partial<RunContext['card']> = {}): RunContext => ({
  card: {
    ...cardInput.parse({ company: 'Example', title: 'Engineer' }),
    id: 'fixture',
    state: 'shortlisted',
    fit: null,
    owner: null,
    packet: null,
    feedback: [],
    createdAt: '',
    updatedAt: '',
    sample: true,
    ...fields,
  },
  role: {
    id: roleId,
    name: roleId,
    description: 'Fixture',
    runtime: 'demo',
    model: '',
    enabled: true,
    instructions: 'Fixture',
  },
  profile: [],
  directory: process.cwd(),
  mcp: { command: '', args: [], env: {} },
  signal: new AbortController().signal,
  onMessage: () => {},
});
/** The single JSON example a workflow prompt tells the runtime to return. */
const example = (prompt: string) => {
  const marker = /Return ONLY JSON(?: in this form)?: /.exec(prompt);
  expect(marker).not.toBeNull();
  const start = marker!.index + marker![0].length;
  return JSON.parse(prompt.slice(start, prompt.indexOf('\n', start))) as Record<string, unknown>;
};
const failure = (text: string, run: RunContext) => {
  try {
    parseWorkflowResult(text, run);
  } catch (error) {
    return error as Error & { code?: string; resultProblem?: string; fields?: string[] };
  }
  throw new Error('Expected the result to be rejected.');
};

describe('workflow prompt result examples', () => {
  const firstDraft = context('writer');
  const revision = context('writer', { state: 'changes_requested', packet });
  const variants = {
    'writer first draft': promptFor(firstDraft),
    'writer revision': promptFor(revision),
    'isolated first draft': promptFor({ ...firstDraft, purpose: 'application-draft' }),
    'isolated revision': promptFor({ ...revision, purpose: 'application-draft' }),
    reviewer: promptFor(context('reviewer', { packet })),
    'isolated review': promptFor({
      ...context('reviewer', { packet }),
      purpose: 'application-review',
    }),
    scout: promptFor(context('scout')),
    'isolated fit': promptFor({ ...context('scout'), purpose: 'fit' }),
    'packet evaluation': promptFor({
      ...context('scout', { packet }),
      purpose: 'packet-evaluation',
    }),
  };

  it.each(Object.entries(variants))(
    '%s: a literally copied example passes the schema',
    (_, prompt) => {
      expect(prompt).not.toContain('"changes":[]');
      expect(runResultSchema.safeParse(example(prompt)).success).toBe(true);
    },
  );

  it('first drafts omit changes and revisions supply a non-empty change note', () => {
    for (const prompt of [variants['writer first draft'], variants['isolated first draft']]) {
      expect(example(prompt)).not.toHaveProperty('changes');
      expect(prompt).toContain('This run writes the first draft');
      expect(prompt).toContain('omit the changes field entirely');
      expect(prompt).not.toContain('This run revises the existing packet');
    }
    for (const prompt of [variants['writer revision'], variants['isolated revision']]) {
      const changes = example(prompt).changes as string[];
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.every((note) => note.trim().length > 0)).toBe(true);
      expect(prompt).toContain('This run revises the existing packet');
      expect(prompt).not.toContain('This run writes the first draft');
    }
  });

  it('treats a packet drafted for an older brief revision as a first draft in isolated runs', () => {
    const stale = context('writer', {
      packet,
      packetContextRevision: 'old',
      applicationContext: { revision: 'new', requirements: [] } as never,
    });
    expect(example(promptFor({ ...stale, purpose: 'application-draft' }))).not.toHaveProperty(
      'changes',
    );
  });

  it('keeps the schema strict: an empty change list is still rejected', () => {
    const writer = { role: 'writer', packet };
    expect(runResultSchema.safeParse({ ...writer, changes: [] }).success).toBe(false);
    expect(runResultSchema.safeParse({ ...writer, changes: [' '] }).success).toBe(false);
    expect(runResultSchema.safeParse(writer).success).toBe(true);
  });

  it.each([undefined, 'readability'] as const)(
    'deep review includes the required perspective set (%s)',
    (perspective) => {
      const run: RunContext = {
        ...context('reviewer', { packet }),
        purpose: 'application-review',
        deepReview: {
          id: 'review-fixture',
          stage: 'review',
          secondOpinions: false,
          requestedPerspectives: [],
          maxConcurrentSubagents: 0,
          alternatives: [],
          ...(perspective ? { subagent: { perspective, focus: 'Readability' } } : {}),
        },
      };
      const result = example(promptFor(run));
      expect(runResultSchema.safeParse(result).success).toBe(true);
      const assessment = result.assessment as { perspectives: { perspective: string }[] };
      expect(assessment.perspectives.map((item) => item.perspective)).toEqual(
        perspective ? [perspective] : [...originalReviewPerspectives],
      );
    },
  );
});

describe('workflow result diagnostics', () => {
  const writer = context('writer');
  const privateText = 'private provider output /Users/fixture/profile.md phx_fixture';

  it('accepts valid results, including fenced JSON and first drafts without changes', () => {
    expect(parseWorkflowResult(JSON.stringify({ role: 'writer', packet }), writer)).toMatchObject({
      role: 'writer',
    });
    const fenced = `\`\`\`json\n${JSON.stringify({ role: 'writer', packet, changes: ['Fixed a claim.'] })}\n\`\`\``;
    expect(parseWorkflowResult(fenced, writer)).toMatchObject({ changes: ['Fixed a claim.'] });
  });

  it.each([
    ['', 'missing', 'finished without a final answer'],
    ['  \n ', 'missing', 'finished without a final answer'],
    ['```json\n```', 'missing', 'finished without a final answer'],
    [privateText, 'invalid_json', 'final answer was not valid JSON'],
    ['{"role":"writer",', 'invalid_json', 'final answer was not valid JSON'],
    ['[]', 'schema', 'did not match the expected shape'],
    ['"private string"', 'schema', 'did not match the expected shape'],
    [
      JSON.stringify({ role: 'reviewer', passed: true, feedback: [] }),
      'wrong_role',
      'not a writer result',
    ],
    [
      JSON.stringify({ role: 'scout', fit: 'private', reasons: [] }),
      'wrong_role',
      'not a writer result',
    ],
  ])('classifies %j as %s without echoing it', (text, problem, wording) => {
    const error = failure(text, writer);
    expect(error.message).toContain('The runtime did not return a valid structured result');
    expect(error.message).toContain(wording);
    expect(error).toMatchObject({
      code: 'PITCHCREW_RUNTIME_RESULT_INVALID',
      resultProblem: problem,
    });
    expect(failureCategory(error)).toBe('validation');
    expect(error.message).not.toMatch(/private|Users|profile\.md|phx|sign-in|model/i);
  });

  it('names known rejected fields, including an empty change list, but never values', () => {
    const error = failure(JSON.stringify({ role: 'writer', packet, changes: [] }), writer);
    expect(error).toMatchObject({ resultProblem: 'schema', fields: ['changes'] });
    expect(error.message).toContain('its writer result had invalid or missing fields: changes');
    expect(error.message).not.toMatch(/café|Fictional|sign-in|model/i);
  });

  it('drops array indexes, invented keys and validator text from field names', () => {
    const error = failure(
      JSON.stringify({
        role: 'writer',
        packet: {
          ...packet,
          resume: '',
          claims: [{ claim: 'private claim', source: '', quote: 'x' }],
        },
        privateInventedKey: privateText,
      }),
      writer,
    );
    expect(error.fields).toEqual(['packet.resume', 'packet.claims.source']);
    expect(error.message).not.toMatch(/private|Users|phx|\[0\]|Too small|String must/i);
  });

  it('caps field names and reports a shape mismatch when no known field applies', () => {
    const many = failure(
      JSON.stringify({
        role: 'reviewer',
        passed: 'x',
        feedback: 'x',
        suggestions: 'x',
        summary: 'x',
        changeSummary: '',
      }),
      context('reviewer'),
    );
    expect(many.fields).toHaveLength(4);
    const missing = failure(JSON.stringify({ role: 'writer' }), writer);
    expect(missing.fields).toEqual(['packet']);
    const unknown = failure(JSON.stringify({ role: 'private-role' }), writer);
    expect(unknown).toMatchObject({ resultProblem: 'schema', fields: ['role'] });
    expect(unknown.message).not.toContain('private-role');
  });
});
