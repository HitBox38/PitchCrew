import { z } from 'zod';

/** Packet documents that house rules can check. Claims are always checked separately. */
export const packetDocuments = ['resume', 'coverLetter', 'formAnswers', 'note'] as const;
export type PacketDocument = (typeof packetDocuments)[number];
export const packetDocumentLabels: Record<PacketDocument, string> = {
  resume: 'Resume',
  coverLetter: 'Cover letter',
  formAnswers: 'Form answers',
  note: 'Note',
};

export const packetRuleLimits = {
  rules: 100,
  patterns: 50,
  patternLength: 300,
  values: 200,
  valueLength: 300,
  messageLength: 300,
  fileBytes: 256 * 1024,
} as const;

const quantifierPattern = /^(?:[*+?]|\{(\d+)(?:(,)(\d*))?\})/;

/** Returns the length of a quantifier at `index` and whether it can repeat more than once. */
function quantifierAt(source: string, index: number) {
  const match = quantifierPattern.exec(source.slice(index));
  if (!match) return null;
  const [text, min, comma, max] = match;
  const repeats =
    text === '*' ||
    text === '+' ||
    (min !== undefined && (comma ? max === '' || Number(max) > 1 : Number(min) > 1));
  const lazy = source[index + text.length] === '?' ? 1 : 0;
  return { length: text.length + lazy, repeats };
}

/** Skips a group prefix such as `?:`, `?=`, `?<!` or `?<name>` and returns the last prefix index. */
function groupPrefixEnd(source: string, open: number) {
  if (source[open + 1] !== '?') return open;
  let index = open + 2;
  if (source[index] === '<' && !['=', '!'].includes(source[index + 1] ?? ''))
    return Math.max(source.indexOf('>', index), index);
  if (source[index] === '<') return index + 1;
  while (index < source.length && !':=!'.includes(source[index])) index++;
  return index;
}

/**
 * Detects a repeated group that itself contains a repeat, such as `(a+)+` or `(\w+\s?)*`.
 * These shapes can take exponential time on near-miss input in a backtracking engine.
 */
export function hasNestedQuantifier(source: string): boolean {
  const groups: boolean[] = [];
  let inClass = false;
  let closedGroupRepeats: boolean | null = null;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const closed = closedGroupRepeats;
    closedGroupRepeats = null;
    if (char === '\\') {
      index++;
      continue;
    }
    if (inClass) {
      if (char === ']') inClass = false;
      continue;
    }
    if (char === '[') {
      inClass = true;
      continue;
    }
    if (char === '(') {
      groups.push(false);
      index = groupPrefixEnd(source, index);
      continue;
    }
    if (char === ')') {
      const inner = groups.pop() ?? false;
      if (inner && groups.length) groups[groups.length - 1] = true;
      closedGroupRepeats = inner;
      continue;
    }
    const quantifier = quantifierAt(source, index);
    if (!quantifier) continue;
    if (quantifier.repeats && closed) return true;
    if (quantifier.repeats && groups.length) groups[groups.length - 1] = true;
    index += quantifier.length - 1;
  }
  return false;
}

/** Returns a user-facing reason when a user-supplied pattern is unsafe or invalid. */
export function patternProblem(pattern: string, flags = ''): string | null {
  if (pattern.length > packetRuleLimits.patternLength)
    return `Patterns can have at most ${packetRuleLimits.patternLength} characters.`;
  if (/\\(?:[1-9]|k<)/.test(pattern)) return 'Backreferences such as \\1 are not allowed.';
  if (hasNestedQuantifier(pattern))
    return 'Nested repeats such as (a+)+ can be very slow. Repeat the inner part only.';
  let expression: RegExp;
  try {
    expression = new RegExp(pattern, flags);
  } catch (error) {
    return `Pattern does not compile: ${error instanceof Error ? error.message : 'invalid syntax'}.`;
  }
  if (expression.test('')) return 'Pattern must not match empty text.';
  return null;
}

const ruleId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'Use 1 to 64 lowercase letters, numbers and dashes.');
const flags = z
  .string()
  .regex(/^[imsu]*$/, 'Use only the i, m, s and u flags.')
  .refine((value) => new Set(value).size === value.length, 'Repeat each flag at most once.')
  .default('');
const pattern = z.string().min(1).max(packetRuleLimits.patternLength);
const ruleBase = {
  id: ruleId,
  severity: z.enum(['error', 'warn']),
  documents: z
    .array(z.enum(packetDocuments))
    .min(1)
    .max(packetDocuments.length)
    .refine((value) => new Set(value).size === value.length, 'List each document once.'),
  message: z.string().trim().min(1).max(packetRuleLimits.messageLength).optional(),
};

/** Pattern safety depends on sibling flags, so each rule validates its own patterns. */
function safePatterns(fields: readonly ('pattern' | 'selector' | 'heading')[]) {
  return (rule: Record<string, unknown>, context: z.RefinementCtx) => {
    for (const field of fields) {
      const source = rule[field];
      if (typeof source !== 'string') continue;
      const problem = patternProblem(source, typeof rule.flags === 'string' ? rule.flags : '');
      if (problem) context.addIssue({ code: 'custom', path: [field], message: problem });
    }
  };
}

export const packetRuleSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...ruleBase,
      kind: z.literal('word_limit'),
      max: z.number().int().min(1).max(100_000),
      count: z.enum(['body', 'all']).default('body'),
    })
    .strict(),
  z
    .object({
      ...ruleBase,
      kind: z.literal('max_bullets'),
      max: z.number().int().min(0).max(1000),
      heading: pattern.optional(),
      flags,
    })
    .strict()
    .superRefine(safePatterns(['heading'])),
  z
    .object({
      ...ruleBase,
      kind: z.literal('canonical_lines'),
      selector: pattern,
      flags,
      values: z
        .array(z.string().trim().min(1).max(packetRuleLimits.valueLength))
        .min(1)
        .max(packetRuleLimits.values),
    })
    .strict()
    .superRefine(safePatterns(['selector'])),
  z
    .object({
      ...ruleBase,
      kind: z.literal('pattern'),
      pattern,
      flags,
      maxCount: z.number().int().min(0).max(1000).optional(),
      equals: z.string().max(packetRuleLimits.valueLength).optional(),
    })
    .strict()
    .superRefine((rule, context) => {
      safePatterns(['pattern'])(rule, context);
      if (rule.maxCount !== undefined && rule.equals !== undefined)
        context.addIssue({
          code: 'custom',
          path: ['equals'],
          message: 'Use either maxCount or equals, not both.',
        });
    }),
]);

export type PacketRule = z.output<typeof packetRuleSchema>;
const patternCount = (rule: PacketRule) =>
  rule.kind === 'word_limit' || (rule.kind === 'max_bullets' && !rule.heading) ? 0 : 1;

export const packetRulesSchema = z
  .object({
    version: z.literal(1),
    rules: z.array(packetRuleSchema).max(packetRuleLimits.rules),
  })
  .strict()
  .superRefine((file, context) => {
    const ids = new Set<string>();
    file.rules.forEach((rule, index) => {
      if (ids.has(rule.id))
        context.addIssue({
          code: 'custom',
          path: ['rules', index, 'id'],
          message: 'Use a unique rule id.',
        });
      ids.add(rule.id);
    });
    if (
      file.rules.reduce((total, rule) => total + patternCount(rule), 0) > packetRuleLimits.patterns
    )
      context.addIssue({
        code: 'custom',
        path: ['rules'],
        message: `Use at most ${packetRuleLimits.patterns} patterns across all rules.`,
      });
  });

export type PacketRules = z.output<typeof packetRulesSchema>;
export type PacketRuleSeverity = PacketRule['severity'];

/** Built-in limits used when the data directory has no packet-rules.json. */
export const defaultPacketRules: PacketRules = {
  version: 1,
  rules: [
    {
      id: 'resume-length',
      kind: 'word_limit',
      severity: 'error',
      documents: ['resume'],
      max: 650,
      count: 'all',
    },
    {
      id: 'cover-letter-length',
      kind: 'word_limit',
      severity: 'error',
      documents: ['coverLetter'],
      max: 500,
      count: 'all',
    },
  ],
};

export interface PacketRuleIssue {
  path: (string | number)[];
  message: string;
}
/** Current rules plus whether they come from the user's file. Invalid files fail closed. */
export interface PacketRulesState {
  rules: PacketRules;
  custom: boolean;
  error: string | null;
}

export function packetRuleIssues(error: z.ZodError): PacketRuleIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.filter((part): part is string | number => typeof part !== 'symbol'),
    message: issue.message,
  }));
}

const quote = (value: string, limit = 60) =>
  JSON.stringify(value.length > limit ? `${value.slice(0, limit)}…` : value);

function describeRule(rule: PacketRule) {
  const where = rule.documents.map((document) => packetDocumentLabels[document]).join(', ');
  const regex = (source: string) => `/${source}/${rule.kind === 'word_limit' ? '' : rule.flags}`;
  const check =
    rule.kind === 'word_limit'
      ? `at most ${rule.max} ${rule.count === 'body' ? 'body words' : 'words'}`
      : rule.kind === 'max_bullets'
        ? `at most ${rule.max} bullets per section${rule.heading ? ` (only sections headed by lines matching ${regex(rule.heading)})` : ''}`
        : rule.kind === 'canonical_lines'
          ? `lines matching ${regex(rule.selector)} must equal one of ${rule.values
              .slice(0, 20)
              .map((value) => quote(value))
              .join(', ')}${rule.values.length > 20 ? ` and ${rule.values.length - 20} more` : ''}`
          : rule.equals !== undefined
            ? `every match of ${regex(rule.pattern)} must capture ${quote(rule.equals)}`
            : `at most ${rule.maxCount ?? 0} matches of ${regex(rule.pattern)}`;
  return `- ${rule.id} (${rule.severity}) ${where}: ${check}.${rule.message ? ` ${rule.message}` : ''}`;
}

/** Compact, prompt-ready summary of house rules. */
export function describePacketRules(rules: PacketRules): string {
  const lines = rules.rules.map(describeRule);
  const text = [
    'Packet rules (errors block the draft, review and export; warnings are advisory):',
    '- Every claim must be an exact quotation from a profile file and appear in the packet (error).',
    ...lines,
  ].join('\n');
  return text.length > 8000 ? `${text.slice(0, 8000)}\n…` : text;
}
