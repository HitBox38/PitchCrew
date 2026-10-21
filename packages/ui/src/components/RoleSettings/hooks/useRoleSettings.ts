import { roleSettingsDirty } from '../helpers.ts';
import { workflowSeat } from '@pitchcrew/core/states';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { capabilityDefaults } from '@/agent-capabilities.ts';
import type { RoleSettingsProps } from '@/components/RoleSettings/types.ts';
import { runtimeLabels } from '@/lib/labels.ts';
import { resolveRuntime } from '@/lib/runtimes.ts';
import type { BrowserMode, ReasoningLevel } from '@pitchcrew/core';
import { useEffect, useState, type FormEvent } from 'react';

export const useRoleSettings = ({
  role,
  reviewInstructions = false,
  creating = false,
  data,
  action,
  working,
  onClose,
  onManageSkills,
  registerLeaveGuard,
}: RoleSettingsProps) => {
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (working) return;
    try {
      await action(
        creating ? '/roles' : `/roles/${role.id}`,
        creating ? 'POST' : 'PUT',
        {
          ...(creating ? { id } : {}),
          name,
          description,
          workflow,
          runtime,
          model,
          reasoning,
          enabled,
          instructions,
          ...(defaultInstructionDraft && instructions !== defaultInstructionDraft.previous
            ? { defaultInstructionRevision: defaultInstructionDraft.revision }
            : {}),
          capabilities,
          browserMode,
        },
        creating ? `${name} created` : `${name} settings saved`,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings.');
    }
  };
  const retire = async () => {
    if (!retiring) {
      setRetiring(true);
      return;
    }
    try {
      await action(`/roles/${role.id}/retire`, 'POST', {}, `${role.name} retired`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not retire role.');
    }
  };

  const [id, setId] = useState(role.id);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [workflow, setWorkflow] = useState(() => workflowSeat(role));
  const [retiring, setRetiring] = useState(false);
  const [runtime, setRuntime] = useState(role.runtime);
  const [model, setModel] = useState(role.model);
  const [reasoning, setReasoning] = useState<ReasoningLevel | null>(role.reasoning ?? null);
  const [browserMode, setBrowserMode] = useState<BrowserMode>(role.browserMode ?? 'supervised');
  const [enabled, setEnabled] = useState(role.enabled);
  const [instructions, setInstructions] = useState(role.instructions);
  const [defaultInstructionDraft, setDefaultInstructionDraft] = useState<{
    revision: string;
    previous: string;
  }>();
  const setDefaultInstructionRevision = (revision: string, previous: string) =>
    setDefaultInstructionDraft({ revision, previous });
  const [capabilities, setCapabilities] = useState({ ...capabilityDefaults, ...role.capabilities });
  const [error, setError] = useState('');
  const dirty = roleSettingsDirty(role, {
    id,
    name,
    description,
    workflow,
    runtime,
    model,
    reasoning,
    enabled,
    browserMode,
    instructions,
    capabilities,
  });
  const guard = useUnsavedChanges(dirty, onClose);
  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent -- This registers a navigation guard; no editable value is forwarded.
    registerLeaveGuard?.(guard.requestLeave);
    return () => registerLeaveGuard?.(null);
  }, [registerLeaveGuard, guard.requestLeave]);
  const close = () => guard.requestLeave(onClose);
  const manageSkills = () => guard.requestLeave(onManageSkills);
  const runtimeCatalog = resolveRuntime(data.runtimes, runtime);
  const runtimes = data.runtimes.some((item) => item.id === runtime)
    ? data.runtimes
    : [...data.runtimes, runtimeCatalog];
  const runtimeItems = runtimes.map((r) => ({
    value: r.id,
    label: `${runtimeLabels[r.id]}${r.available ? '' : ' (unavailable)'}`,
  }));
  const runtimeAvailable = runtimeCatalog.available;
  return {
    reviewInstructions,
    creating,
    id,
    setId,
    name,
    setName,
    description,
    setDescription,
    workflow,
    setWorkflow,
    retiring,
    retire,
    role,
    data,
    action,
    working,
    onClose: close,
    onManageSkills: manageSkills,
    guard,
    runtime,
    setRuntime,
    model,
    setModel,
    reasoning,
    setReasoning,
    enabled,
    setEnabled,
    browserMode,
    setBrowserMode,
    instructions,
    setInstructions,
    setDefaultInstructionRevision,
    capabilities,
    setCapabilities,
    error,
    setError,
    runtimeItems,
    runtimeCatalog,
    runtimeAvailable,
    save,
  };
};
