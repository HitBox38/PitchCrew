import type { ReasoningLevel, RuntimeId } from '@pitchcrew/core';

// Editorial starting points, not measured runtime rankings. Keep selectors in adapters.
// https://learn.chatgpt.com/docs/models
// https://platform.claude.com/docs/en/models/overview
const sol = 'gpt-6.1-sol';
const astra = 'gpt-6-astra';
const luna = 'gpt-6-luna';
const sonnet = 'claude-sonnet-5-5';
const opus = 'claude-opus-5-5';
const haiku = 'claude-haiku-4-5';
const pro = 'gemini-pro';
const flash = 'gemini-flash';

interface RecommendationPlan {
  runtime: RuntimeId;
  models: readonly string[];
  reasoning: ReasoningLevel;
}
export const recommendationPlans: Readonly<Record<string, RecommendationPlan>> = {
  scout: {
    runtime: 'codex',
    models: [sol, astra, sonnet, opus, pro, luna, flash, haiku],
    reasoning: 'medium',
  },
  writer: {
    runtime: 'claude-code',
    models: [sonnet, opus, sol, astra, pro, luna, flash, haiku],
    reasoning: 'high',
  },
  reviewer: {
    runtime: 'codex',
    models: [astra, opus, sol, sonnet, pro, luna, haiku, flash],
    reasoning: 'high',
  },
  submitter: {
    runtime: 'codex',
    models: [sol, astra, sonnet, opus, pro, luna, flash, haiku],
    reasoning: 'medium',
  },
  tracker: {
    runtime: 'codex',
    models: [luna, sonnet, sol, haiku, flash, astra, opus, pro],
    reasoning: 'high',
  },
  documenter: {
    runtime: 'codex',
    models: [sol, sonnet, astra, opus, pro, luna, flash, haiku],
    reasoning: 'medium',
  },
  'pipeline-coach': {
    runtime: 'codex',
    models: [astra, opus, sol, sonnet, pro, luna, haiku, flash],
    reasoning: 'high',
  },
};

export const recommendedRuntimeOrder: readonly RuntimeId[] = [
  'codex',
  'claude-code',
  'opencode',
  'copilot-cli',
  'oh-my-pi',
  'pi',
  'cursor-agent',
  'gemini-cli',
  'kiro-cli',
  'hermes',
  'goose',
  'grok',
];

// Older installed CLI catalogs can still offer useful explicit alternatives.
export const previousModels = [
  'gpt-6-sol',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'gpt-5.6-luna',
  'claude-sonnet-4-5',
  'grok-4.7',
] as const;
