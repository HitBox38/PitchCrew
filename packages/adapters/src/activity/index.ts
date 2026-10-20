import type { ChatContext, RunContext, RuntimeActivity } from '@pitchcrew/core';

/** Public text and phase signals only. Tool arguments/results and thinking text stay private. */
export const activityStream = (context: RunContext | ChatContext) => {
  let sequence = 0;
  let commentary: RuntimeActivity | undefined;
  let thinking: RuntimeActivity | undefined;
  const emit = (entry: RuntimeActivity) => {
    if (('messages' in context || context.deepReview) && !context.signal.aborted)
      context.onActivity?.(entry);
  };
  const endThinking = () => {
    if (thinking) emit({ ...thinking, status: 'completed' });
    thinking = undefined;
  };
  const endText = () => {
    if (commentary) emit({ ...commentary, status: 'completed' });
    commentary = undefined;
  };
  return {
    thinking: () => {
      endText();
      if (!thinking) {
        thinking = {
          id: `thinking-${++sequence}`,
          kind: 'reasoning',
          label: 'Thinking',
          status: 'running',
        };
        emit(thinking);
      }
    },
    boundary: () => {
      endText();
      endThinking();
    },
    text: (raw: string) => {
      if (!raw) {
        endText();
        return;
      }
      endThinking();
      // Hold structured answers and partial code fences, including their opening characters.
      if (/^\s*[[{`]/.test(raw) || !raw.trim()) return;
      const text = raw.slice(0, 4000).replace(/[\uD800-\uDBFF]$/, '');
      if (commentary?.text === text) return;
      commentary = {
        id: commentary?.id ?? `commentary-${++sequence}`,
        kind: 'commentary',
        label: 'Progress update',
        text,
        status: 'running',
      };
      emit(commentary);
    },
  };
};
