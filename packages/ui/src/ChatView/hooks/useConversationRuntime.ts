import { useState } from 'react';
import type { ReasoningLevel, RuntimeId } from '@pitchcrew/core';
import { resolveRuntime } from '@/lib/runtimes.ts';
import type { ChatViewModel } from '../types.ts';

export function useConversationRuntime({
  data,
  role,
  conversation,
  patchConversation,
  setDialog,
}: ChatViewModel) {
  const defaults = data.roles.find((agent) => agent.id === role.id)!;
  const override = conversation?.configurations[role.id];
  const [runtime, setRuntime] = useState<RuntimeId | undefined>(override?.runtime);
  const [model, setModel] = useState<string | undefined>(override?.model);
  const [reasoning, setReasoning] = useState<ReasoningLevel | null | undefined>(
    override?.reasoning,
  );
  const effectiveRuntime = runtime ?? defaults.runtime;
  const selected = resolveRuntime(data.runtimes, effectiveRuntime);
  const changeRuntime = (next: string) => {
    const inherit = next === 'agent';
    setRuntime(inherit ? undefined : (next as RuntimeId));
    setModel(inherit ? undefined : '');
    setReasoning(inherit ? undefined : null);
  };
  const save = async () => {
    const configuration = {
      ...(runtime === undefined ? {} : { runtime }),
      ...(model === undefined ? {} : { model }),
      ...(reasoning === undefined ? {} : { reasoning }),
    };
    if (await patchConversation({ configurations: { [role.id]: configuration } })) setDialog(null);
  };
  return {
    runtime,
    model,
    reasoning,
    defaults,
    effectiveRuntime,
    selected,
    changeRuntime,
    setModel,
    setReasoning,
    save,
    canSave:
      selected.available ||
      (runtime === undefined && model === undefined && reasoning === undefined),
  };
}
