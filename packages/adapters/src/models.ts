import type { RuntimeModel } from '@pitchcrew/core';

// Shared suggestions for runtimes with built-in API providers. Values retain the
// provider prefix required by each CLI; authentication remains owned by the CLI.
// https://opencode.ai/docs/models/
// https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md
// https://github.com/can1357/oh-my-pi/blob/main/docs/models.md
export const apiModels: readonly RuntimeModel[] = [
  { value: 'anthropic/claude-sonnet-5-5', label: 'Anthropic · Claude Sonnet 5.5' },
  { value: 'anthropic/claude-opus-5-5', label: 'Anthropic · Claude Opus 5.5' },
  { value: 'anthropic/claude-haiku-4-5', label: 'Anthropic · Claude Haiku 4.5' },
  { value: 'openai/gpt-6.1-sol', label: 'OpenAI · GPT-6.1 Sol' },
  { value: 'openai/gpt-6-sol', label: 'OpenAI · GPT-6 Sol' },
  { value: 'openai/gpt-6-luna', label: 'OpenAI · GPT-6 Luna' },
  { value: 'google/gemini-3.5-flash', label: 'Google · Gemini 3.5 Flash' },
  { value: 'google/gemini-3.1-pro-preview', label: 'Google · Gemini 3.1 Pro Preview' },
];
