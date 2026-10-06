import type { RuntimeId, RuntimeModel } from '@pitchcrew/core';

/** Match known model selectors, never a provider's display name or an arbitrary first row. */
export function recommendationModel(runtime: RuntimeId, model: RuntimeModel): string {
  let value = model.value.split('/').at(-1)!;
  if (runtime === 'hermes') value = value.split(':').at(-1)!;
  if (runtime === 'cursor-agent') value = value.replace(/-(low|medium|high|xhigh|max)$/, '');
  if (runtime === 'claude-code') {
    if (value === 'sonnet') return 'claude-sonnet-5-5';
    if (value === 'opus') return 'claude-opus-5-5';
    if (value === 'haiku') return 'claude-haiku-4-5';
  }
  // Copilot and Kiro use dotted Claude version selectors.
  value = value.replace(/^(claude-(?:sonnet|opus|haiku)-\d+)\.(\d+)/, '$1-$2');
  if (/^claude-haiku-4-5(?:-\d{8})?$/.test(value)) return 'claude-haiku-4-5';
  if (runtime === 'gemini-cli') {
    if (value === 'pro') return 'gemini-pro';
    if (value === 'flash') return 'gemini-flash';
  }
  if (/^gemini-3(?:\.\d+)?-pro(?:-preview)?$/.test(value)) return 'gemini-pro';
  if (/^gemini-3(?:\.\d+)?-flash(?:-preview)?$/.test(value)) return 'gemini-flash';
  return value;
}
