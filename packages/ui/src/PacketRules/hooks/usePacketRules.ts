import { useMemo, useState, type FormEvent } from 'react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { rulesFileBytes, rulesFileName } from '../constants.ts';
import { formatRules, parseDraft, ruleViews } from '../helpers.ts';
import type { PacketRulesProps } from '../types.ts';
import { useRulesValidation } from './useRulesValidation.ts';

export function usePacketRules({ state }: PacketRulesProps) {
  const action = useWorkspaceStore((store) => store.action);
  const working = useWorkspaceStore((store) => store.working);
  const setToast = useWorkspaceStore((store) => store.setToast);
  const saved = useMemo(() => formatRules(state.rules), [state.rules]);
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? saved;
  const dirty = draft !== null && draft !== saved;
  const parsed = useMemo(() => parseDraft(text), [text]);
  const { issues, checking } = useRulesValidation(parsed, dirty);
  const guard = useUnsavedChanges(dirty, () => setDraft(null));
  const rules = ruleViews('value' in parsed ? parsed.value : null);
  const canSave = dirty && !checking && !issues.length && !working;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canSave || !('value' in parsed)) return;
    try {
      await action('/packet-rules', 'PUT', parsed.value, 'Packet rules saved');
      setDraft(null);
    } catch {
      // The action toast reports the failure; the draft stays for correction.
    }
  }
  async function importFile(file: File) {
    if (file.size > rulesFileBytes) {
      setToast(`Rules files can be at most ${rulesFileBytes / 1024} KB.`, 'error');
      return;
    }
    setDraft(await file.text());
    setToast(`Loaded ${file.name}. Review the rules, then save.`, 'info');
  }
  function exportFile() {
    const url = URL.createObjectURL(new Blob([saved], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = rulesFileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  const restoreDefaults = () =>
    void action('/packet-rules', 'DELETE', undefined, 'Restored the default packet rules')
      .then(() => setDraft(null))
      .catch(() => {});

  return {
    state,
    text,
    setText: setDraft,
    discard: () => setDraft(null),
    dirty,
    checking,
    issues,
    rules,
    canSave,
    working,
    guard,
    save,
    importFile,
    exportFile,
    restoreDefaults,
  };
}
export type PacketRulesController = ReturnType<typeof usePacketRules>;
