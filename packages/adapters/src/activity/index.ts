import type { ChatContext, RunContext, RuntimeActivity } from '@pitchcrew/core';
import { nativeToolTracker, type NativeToolEvent } from './native-tools.ts';

/** Turns with a transcript: chat, and deep-review stages. Workflow runs stay silent. */
export const showsActivity = (context: RunContext | ChatContext) =>
  'messages' in context || !!context.deepReview;

/**
 * Public text, phase signals and normalized tool steps. Thinking text and raw tool arguments and
 * results stay private; tool steps carry only a redacted one-line detail and failure reason. Runs
 * that show no steps report only failed calls, through `onToolFailure`, in closed words.
 */
export const activityStream = (
  context: RunContext | ChatContext,
  /** Exact secret values from the runtime's environment, removed from tool text. */
  secrets: readonly string[] = [],
) => {
  let sequence = 0;
  let commentary: RuntimeActivity | undefined;
  let thinking: RuntimeActivity | undefined;
  const emit = (entry: RuntimeActivity) => {
    if (context.signal.aborted) return;
    if (showsActivity(context)) context.onActivity?.(entry);
    // A run without steps passes on only a failed call's closed failure, for diagnostics.
    else if (entry.status === 'failed' && entry.failure)
      context.onToolFailure?.({ ...entry.failure, kind: entry.tool ?? 'other' });
  };
  const endThinking = () => {
    if (thinking) emit({ ...thinking, status: 'completed' });
    thinking = undefined;
  };
  const endText = () => {
    if (commentary) emit({ ...commentary, status: 'completed' });
    commentary = undefined;
  };
  const tools = nativeToolTracker(emit, secrets);
  const boundary = () => {
    endText();
    endThinking();
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
    boundary,
    /**
     * A normalized native tool call. A call that appears ends the current commentary or thinking:
     * its start, or a finish that describes the call (runtimes that report only finished calls),
     * so text after the call never overwrites the text before it.
     */
    tool: (event: NativeToolEvent) => {
      if (event.phase === 'start' || event.kind || event.pitchcrew) boundary();
      tools(event);
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
