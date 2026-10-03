import { workflowSeat } from '@pitchcrew/core/states';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { capabilityDefaults } from '@/agent-capabilities.ts';
import type { RoleSettingsProps } from '@/components/RoleSettings/types.ts';
import { runtimeLabels } from '@/lib/labels.ts';
import { useState, type FormEvent } from 'react';

export function useRoleSettings({
  role,
  creating = false,
  data,
  action,
  working,
  onClose,
  onManageSkills,
}: RoleSettingsProps) {
  const [id, setId] = useState(role.id);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [workflow, setWorkflow] = useState(workflowSeat(role));
  const [retiring, setRetiring] = useState(false);
  const [runtime, setRuntime] = useState(role.runtime);
  const [model, setModel] = useState(role.model);
  const [enabled, setEnabled] = useState(role.enabled);
  const [instructions, setInstructions] = useState(role.instructions);
  const [capabilities, setCapabilities] = useState({ ...capabilityDefaults, ...role.capabilities });
  const [error, setError] = useState('');
  const dirty =
    id !== role.id ||
    name !== role.name ||
    description !== role.description ||
    workflow !== workflowSeat(role) ||
    runtime !== role.runtime ||
    model !== role.model ||
    enabled !== role.enabled ||
    instructions !== role.instructions ||
    JSON.stringify(capabilities) !==
      JSON.stringify({ ...capabilityDefaults, ...role.capabilities });
  const guard = useUnsavedChanges(dirty, onClose);
  const close = () => guard.requestLeave(onClose);
  const manageSkills = () => guard.requestLeave(onManageSkills);
  const runtimeItems = data.runtimes.map((r) => ({
    value: r.id,
    label: `${runtimeLabels[r.id]}${r.available ? '' : ' (unavailable)'}`,
  }));
  const runtimeCatalog = data.runtimes.find((item) => item.id === runtime)!;
  const runtimeAvailable = runtimeCatalog.available;
  async function save(e: FormEvent) {
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
          enabled,
          instructions,
          capabilities,
        },
        creating ? `${name} created` : `${name} settings saved`,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings.');
    }
  }
  async function retire() {
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
  }
  return {
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
    working,
    onClose: close,
    onManageSkills: manageSkills,
    guard,
    runtime,
    setRuntime,
    model,
    setModel,
    enabled,
    setEnabled,
    instructions,
    setInstructions,
    capabilities,
    setCapabilities,
    error,
    setError,
    runtimeItems,
    runtimeCatalog,
    runtimeAvailable,
    save,
  };
}
