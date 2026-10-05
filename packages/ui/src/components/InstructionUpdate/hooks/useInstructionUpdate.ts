import { capabilityLabels } from '@/agent-capabilities.ts';
import { useMemo, useState } from 'react';
import { diffCounts, diffInstructions } from '../helpers.ts';
import type { ComparisonMode, InstructionUpdateProps } from '../types.ts';

export function useInstructionUpdate({
  role,
  update,
  action,
  working,
  instructions,
  setInstructions,
}: InstructionUpdateProps) {
  const [mode, setMode] = useState<ComparisonMode>('yours');
  const [expanded, setExpanded] = useState(!update.dismissed);
  const [previous, setPrevious] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Replacing text the user wrote takes a second, explicit click.
  const [confirming, setConfirming] = useState(false);
  const ownText = update.state !== 'unedited';
  const before = mode === 'default' && update.base ? update.base.instructions : role.instructions;
  const lines = useMemo(
    () => diffInstructions(before, update.instructions),
    [before, update.instructions],
  );
  const tools = update.toolDifferences.map((key) => capabilityLabels[key]);
  // Use new default saves at once, so it waits until unsaved instruction edits are resolved.
  const unsaved = instructions !== role.instructions;
  const path = `/roles/${role.id}/instructions-update`;
  async function adopt() {
    setError('');
    if (ownText && !confirming) {
      setConfirming(true);
      return;
    }
    try {
      await action(
        `${path}/adopt`,
        'POST',
        { revision: update.revision },
        `${role.name} now uses the new default instructions`,
      );
      setInstructions(update.instructions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not use the new default.');
    }
  }
  async function dismiss() {
    setError('');
    try {
      await action(
        `${path}/dismiss`,
        'POST',
        { revision: update.revision },
        `Kept your instructions for ${role.name}`,
      );
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not keep your instructions.');
    }
  }
  function startFromDefault() {
    setPrevious(role.instructions);
    setInstructions(update.instructions);
  }
  return {
    role,
    update,
    working,
    mode,
    setMode,
    expanded,
    setExpanded,
    previous,
    error,
    lines,
    counts: diffCounts(lines),
    tools,
    unsaved,
    ownText,
    confirming,
    adopt,
    dismiss,
    startFromDefault,
  };
}
