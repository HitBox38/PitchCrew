import { ReasoningField } from '@/ReasoningField/index.tsx';
import { reasoningLabels } from '@/lib/reasoning.ts';
import type { ChatComposerProps } from '../types.ts';

export function ComposerReasoning({
  role,
  reasoningOptions,
  reasoningChoice,
  setReasoningChoice,
  busy,
  working,
}: Pick<
  ChatComposerProps,
  'role' | 'reasoningOptions' | 'reasoningChoice' | 'setReasoningChoice' | 'busy' | 'working'
>) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
      <ReasoningField
        compact
        id="chat-reasoning"
        reasoning={reasoningOptions}
        value={reasoningChoice}
        onValueChange={setReasoningChoice}
        disabled={busy || working}
        agentDefault={`Agent default (${role.reasoning ? reasoningLabels[role.reasoning] : 'CLI default'})`}
      />
      <span className="optional text-xs">Applies to your next messages.</span>
    </div>
  );
}
