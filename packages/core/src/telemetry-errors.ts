import { z } from 'zod';
import stripAnsi from 'strip-ansi';

export const agentProblemAreas = [
  'mcp',
  'browser',
  'runtime',
  'documents',
  'sources',
  'workspace',
  'other',
] as const;

export const agentProblemTextLimits = {
  error_summary: 160,
  error_expected: 600,
  error_actual: 600,
  error_steps: 1000,
  error_workaround: 400,
} as const;

const text = (max: number) => z.string().trim().min(1).max(max);
/** Optional details retain compatibility with already-running clients. New prompts require them. */
export const agentProblemInputShape = {
  area: z.enum(agentProblemAreas),
  kind: z.enum(['bug', 'missing_capability']).optional(),
  summary: text(agentProblemTextLimits.error_summary)
    .describe('Generic product problem title, without user or application details.')
    .optional(),
  expected: text(agentProblemTextLimits.error_expected)
    .describe('Expected product behavior or the capability needed.')
    .optional(),
  actual: text(agentProblemTextLimits.error_actual)
    .describe('Observed behavior; paraphrase errors without copying raw output.')
    .optional(),
  steps: text(agentProblemTextLimits.error_steps)
    .describe('Minimal reproduction steps using generic placeholders.')
    .optional(),
  workaround: text(agentProblemTextLimits.error_workaround)
    .describe('Workaround tried and its result, or that none is available.')
    .optional(),
  tool: z
    .string()
    .max(100)
    .regex(/^pitchcrew_[a-z][a-z0-9_]*$/)
    .describe('Related public MCP tool name, if known; never invent a tool.')
    .optional(),
};

export const agentProblemInput = z
  .object(agentProblemInputShape)
  .strict()
  .superRefine((input, ctx) => {
    if (Object.keys(input).some((key) => key !== 'area')) {
      for (const key of ['summary', 'expected', 'actual'] as const)
        if (!input[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'Include summary, expected and actual for a detailed report.',
          });
    }
  });

/** Defense in depth, not anonymization: agents must write generic product descriptions. */
export const sanitizeProblemText = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) return undefined;
  return (
    stripAnsi(value)
      // eslint-disable-next-line no-control-regex -- Remove nonprinting characters from outbound prose.
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
      .replace(/\b(?:https?:\/\/|file:\/\/|www\.)[^\s<>"']+/gi, '[url]')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
      .replace(/(?:[A-Z]:\\|\/(?:Users|home|tmp|var|private|etc)\/|~\/)[^\s<>"']+/gi, '[path]')
      .replace(
        /\b(?:Bearer\s+\S+|(?:sk|phx|phc|ghp|github_pat)[_-][a-z0-9_-]+)\b/gi,
        '[credential]',
      )
      .replace(
        /\b(?:api[_-]?key|token|password|secret|authorization)\s*[:=]\s*[^\s,;]+/gi,
        '[credential]',
      )
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)
  );
};

/** Shared by the daemon buffer and renderer outbound boundary. */
export const sanitizeAgentProblem = (
  input: Record<string, unknown>,
): Record<string, string> | null => {
  const area = input.error_area;
  if (
    input.error_source !== 'agent_report' ||
    input.error_category !== 'technical_problem' ||
    typeof area !== 'string' ||
    !agentProblemAreas.includes(area as (typeof agentProblemAreas)[number])
  )
    return null;
  const result: Record<string, string> = {
    error_source: 'agent_report',
    error_category: 'technical_problem',
    error_area: area,
  };
  for (const [key, max] of Object.entries(agentProblemTextLimits)) {
    const value = sanitizeProblemText(input[key], max);
    if (value) result[key] = value;
  }
  if (result.error_summary && result.error_expected && result.error_actual) {
    result.error_kind = input.error_kind === 'missing_capability' ? 'missing_capability' : 'bug';
    if (
      typeof input.error_tool === 'string' &&
      input.error_tool.length <= 100 &&
      /^pitchcrew_[a-z][a-z0-9_]*$/.test(input.error_tool)
    )
      result.error_tool = input.error_tool;
  } else {
    for (const key of Object.keys(agentProblemTextLimits)) delete result[key];
  }
  return result;
};

/** Stable grouping by sanitized problem, rather than putting every failure in one area together. */
export const agentProblemFingerprint = (problem: Record<string, string>): string => {
  const base = `pitchcrew-v1:agent_report:technical_problem:${problem.error_area}`;
  if (!problem.error_summary) return base;
  const identity = JSON.stringify([
    problem.error_kind,
    problem.error_tool,
    problem.error_summary.toLowerCase(),
  ]);
  let hash = 2166136261;
  for (let i = 0; i < identity.length; i++)
    hash = Math.imul(hash ^ identity.charCodeAt(i), 16777619);
  return `${base}:${(hash >>> 0).toString(16)}`;
};
