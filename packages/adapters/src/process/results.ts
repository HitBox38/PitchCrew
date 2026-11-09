import type { RunContext, RunResult } from '@pitchcrew/core';
import { runResultSchema, workflowSeat } from '@pitchcrew/core';

/** Why a workflow result was rejected; never carries runtime output or values. */
export type ResultProblem = 'missing' | 'invalid_json' | 'schema' | 'wrong_role';

// Field names come from Pitchcrew's own result schema. Anything else (including keys a runtime
// invented) is never echoed, so a diagnostic cannot carry provider output into run history.
const knownFields = new Set([
  'role',
  'changeSummary',
  'fit',
  'reasons',
  'packetFit',
  'score',
  'packet',
  'resume',
  'coverLetter',
  'formAnswers',
  'note',
  'claims',
  'claim',
  'source',
  'quote',
  'changes',
  'passed',
  'feedback',
  'suggestions',
  'assessment',
  'summary',
  'highlights',
  'limitations',
  'nextSteps',
  'packetFeedback',
  'perspectives',
  'perspective',
  'verdict',
  'rationale',
  'weakestLine',
  'interviewQuestions',
  'findings',
  'severity',
  'reason',
  'correction',
]);
const maxFields = 4;

/** Dotted schema paths for rejected fields, dropping array indexes and unknown keys. */
export const rejectedFields = (error: {
  issues: ReadonlyArray<{ code: string; path: readonly PropertyKey[] }>;
}) => {
  const fields = new Set<string>();
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') continue;
    const names = issue.path.filter((part): part is string => typeof part === 'string');
    if (!names.length || !names.every((name) => knownFields.has(name))) continue;
    fields.add(names.join('.'));
  }
  return [...fields].slice(0, maxFields);
};

const detail = (problem: ResultProblem, seat: string, fields: string[]) => {
  if (problem === 'missing') return 'it finished without a final answer';
  if (problem === 'invalid_json') return 'its final answer was not valid JSON';
  if (problem === 'wrong_role') return `its answer was not a ${seat} result`;
  return fields.length
    ? `its ${seat} result had invalid or missing fields: ${fields.join(', ')}`
    : `its ${seat} result did not match the expected shape`;
};

/** A rejected result: fixed wording, a category and known field names only. */
export const runtimeResultError = (resultProblem: ResultProblem, fields: string[], seat: string) =>
  Object.assign(
    new Error(
      `The runtime did not return a valid structured result: ${detail(resultProblem, seat, fields)}. Nothing was saved from this run. Retry the step.`,
    ),
    { code: 'PITCHCREW_RUNTIME_RESULT_INVALID', resultProblem, fields },
  );

/**
 * Parse a workflow result. Failures keep only a fixed category and known schema field names;
 * the runtime's text, values and validator messages stay out of the error.
 */
export const parseWorkflowResult = (text: string, context: RunContext): RunResult => {
  const seat = workflowSeat(context.role);
  const cleaned = cleanResult(text);
  if (!cleaned) throw runtimeResultError('missing', [], seat);
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    throw runtimeResultError('invalid_json', [], seat);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw runtimeResultError('schema', [], seat);
  const parsed = runResultSchema.safeParse(data);
  if (!parsed.success) {
    const role = (data as { role?: unknown }).role;
    if (typeof role === 'string' && role !== seat && ['scout', 'writer', 'reviewer'].includes(role))
      throw runtimeResultError('wrong_role', [], seat);
    throw runtimeResultError('schema', rejectedFields(parsed.error), seat);
  }
  if (parsed.data.role !== seat) throw runtimeResultError('wrong_role', [], seat);
  return parsed.data;
};
export const cleanResult = (text: string) => {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/\s*```$/, '');
};
export const parseResult = (text: string, context: RunContext): RunResult => {
  const cleaned = cleanResult(text);
  const result = runResultSchema.parse(JSON.parse(cleaned));
  if (result.role !== workflowSeat(context.role))
    throw new Error('The runtime returned a result for the wrong role.');
  return result;
};
