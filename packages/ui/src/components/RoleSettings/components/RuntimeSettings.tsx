import type { RuntimeSettingsProps } from '@/components/RoleSettings/types.ts';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import { SelectContent } from '@/components/ui/select/components/SelectContent.tsx';
import { SelectItem } from '@/components/ui/select/components/SelectItem.tsx';
import { SelectTrigger } from '@/components/ui/select/components/SelectTrigger.tsx';
import { SelectValue } from '@/components/ui/select/components/SelectValue.tsx';
import { Select } from '@/components/ui/select/constants.ts';
import { ModelField } from '@/ModelField/index.tsx';
import type { Role } from '@pitchcrew/core';

export function RuntimeSettings({
  role,
  runtime,
  setRuntime,
  setModel,
  reasoning,
  setReasoning,
  runtimeItems,
  runtimeAvailable,
  runtimeCatalog,
  model,
  enabled,
  setEnabled,
  children,
  stacked,
}: RuntimeSettingsProps) {
  return (
    <section className="role-settings-section" aria-labelledby={`${role.id}-runtime-heading`}>
      <h3 id={`${role.id}-runtime-heading`}>Runtime and model</h3>
      <div
        className={`form-row grid gap-3.5 ${stacked ? 'grid-cols-1' : 'grid-cols-2 max-compact:grid-cols-1'}`}
      >
        <div className="field">
          <label htmlFor={`${role.id}-runtime`}>Runtime</label>
          <Select
            value={runtime}
            onValueChange={(value: Role['runtime'] | null) => {
              if (value && value !== runtime) {
                setRuntime(value);
                setModel('');
                setReasoning(null);
              }
            }}
            items={runtimeItems}
          >
            <SelectTrigger id={`${role.id}-runtime`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} sideOffset={6}>
              {runtimeItems.map((item) => (
                <SelectItem value={item.value} key={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ModelField
          key={runtime}
          id={`${role.id}-model`}
          runtime={runtime}
          available={runtimeAvailable}
          initialCatalog={runtimeCatalog}
          value={model}
          onValueChange={setModel}
          reasoning={reasoning}
          onReasoningChange={setReasoning}
        />
      </div>
      {children}
      <label className="checkbox-label">
        <Checkbox
          aria-label="Enable this role"
          checked={enabled}
          onCheckedChange={(checked) => setEnabled(checked)}
        />
        Enable this role
      </label>
    </section>
  );
}
