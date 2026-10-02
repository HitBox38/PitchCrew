import { capabilityDefaults } from '@/agent-capabilities.ts';
import type { RoleSettingsProps } from '@/components/RoleSettings/types.ts';
import { runtimeLabels } from '@/lib/labels.ts';
import { useState, type FormEvent } from 'react';

export function useRoleSettings({
  role,
  data,
  action,
  working,
  onClose,
  onManageSkills,
}: RoleSettingsProps) {
  const [runtime, setRuntime] = useState(role.runtime);
  const [model, setModel] = useState(role.model);
  const [enabled, setEnabled] = useState(role.enabled);
  const [instructions, setInstructions] = useState(role.instructions);
  const [capabilities, setCapabilities] = useState({ ...capabilityDefaults, ...role.capabilities });
  const [error, setError] = useState('');
  const runtimeItems = data.runtimes.map((r) => ({
    value: r.id,
    label: `${runtimeLabels[r.id]}${r.available ? '' : ' (unavailable)'}`,
  }));
  const runtimeCatalog = data.runtimes.find((item) => item.id === runtime)!;
  const runtimeAvailable = runtimeCatalog.available;
  async function save(e: FormEvent) {
    e.preventDefault();
    if (working || !runtimeAvailable) return;
    try {
      await action(
        `/roles/${role.id}`,
        'PUT',
        { runtime, model, enabled, instructions, capabilities },
        `${role.name} settings saved`,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings.');
    }
  }
  return {
    role,
    data,
    working,
    onClose,
    onManageSkills,
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
