import type { RunContext, RunResult } from '@pitchcrew/core';
import { runResultSchema, workflowSeat } from '@pitchcrew/core';

export function parseWorkflowResult(text: string, context: RunContext): RunResult {
  try {
    return parseResult(text, context);
  } catch {
    throw new Error(
      'The runtime did not return a valid structured result. Check its model/sign-in and retry.',
    );
  }
}
export function cleanResult(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/\s*```$/, '');
}
export function parseResult(text: string, context: RunContext): RunResult {
  const cleaned = cleanResult(text);
  const result = runResultSchema.parse(JSON.parse(cleaned));
  if (result.role !== workflowSeat(context.role))
    throw new Error('The runtime returned a result for the wrong role.');
  return result;
}
