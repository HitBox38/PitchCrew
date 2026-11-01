import type { RuntimeSettingsProps } from '@/components/RoleSettings/types.ts';
import { Switch } from '@pitchcrew/design-system/switch';
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Select,
} from '@pitchcrew/design-system/select';
import { ModelField } from '@/ModelField/index.tsx';
import type { Role } from '@pitchcrew/core';

export const RuntimeSettings = ({
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
  bare,
  hideEnabled,
}: RuntimeSettingsProps) => {
  return (
    <section
      className="agent-panel-section"
      id={bare ? undefined : 'agent-runtime'}
      aria-labelledby={bare ? undefined : `${role.id}-runtime-heading`}
    >
      {bare ? null : <h3 id={`${role.id}-runtime-heading`}>Runtime, model and reasoning</h3>}
      <div
        className={`agent-runtime-fields grid gap-4 ${stacked ? 'grid-cols-1' : 'grid-cols-2 max-compact:grid-cols-1'}`}
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
      {hideEnabled ? null : (
        <div className="agent-tool">
          <span className="agent-tool-copy">
            <label htmlFor={`${role.id}-enabled`}>Enable this role</label>
            <span>{enabled ? 'Takes new work and routines.' : 'Paused. Starts no new work.'}</span>
          </span>
          <Switch
            id={`${role.id}-enabled`}
            aria-label="Enable this role"
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked)}
          />
        </div>
      )}
    </section>
  );
};
