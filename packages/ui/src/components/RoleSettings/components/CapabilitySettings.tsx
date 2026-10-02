import { capabilityLabels } from '@/agent-capabilities.ts';
import type { CapabilitySettingsProps } from '@/components/RoleSettings/types.ts';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';

export function CapabilitySettings({
  role,
  capabilities,
  setCapabilities,
}: CapabilitySettingsProps) {
  return (
    <section className="role-settings-section" aria-labelledby={`${role.id}-capabilities-heading`}>
      <h3 id={`${role.id}-capabilities-heading`}>Agent capabilities</h3>
      {[
        {
          title: 'Crew coordination',
          entries: Object.entries(capabilityLabels).slice(0, 3),
        },
        {
          title: 'Connected services',
          entries: Object.entries(capabilityLabels).slice(3, 8),
        },
        { title: 'Computer use', entries: Object.entries(capabilityLabels).slice(8) },
      ].map((group) => (
        <fieldset className="role-settings-capabilities" key={group.title}>
          <legend>{group.title}</legend>
          {group.entries.map(([key, label]) => (
            <label className="checkbox-label" key={key}>
              <Checkbox
                checked={capabilities[key as keyof typeof capabilities]}
                onCheckedChange={(checked) =>
                  setCapabilities((current) => ({ ...current, [key]: checked }))
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
      ))}
      <p className="quiet">
        Crew follow-ups run after the current turn finishes, with at most six per chain. Agents
        propose instruction and capability changes for you to apply in chat.
      </p>
    </section>
  );
}
