import { WorkSection } from '@/ChatWork/components/WorkSection.tsx';
import { capabilityDefaults, capabilityLabels } from '@/agent-capabilities.ts';
import type { RoleCapabilitiesProps } from '@/ChatWork/types.ts';
import { Button } from '@pitchcrew/design-system/button';
import { SlidersHorizontal } from 'lucide-react';

export const RoleCapabilities = ({ role, onConfigure }: RoleCapabilitiesProps) => {
  const entries = Object.entries(capabilityLabels).map(([key, label]) => ({
    key,
    label,
    enabled:
      role.capabilities?.[key as keyof typeof capabilityLabels] ??
      capabilityDefaults[key as keyof typeof capabilityLabels],
  }));
  const on = entries.filter((entry) => entry.enabled).length;
  return (
    <WorkSection className="chat-work-section chat-role-summary">
      <div className="chat-work-heading">
        <div>
          <h3>
            How {role.name} works
            <span className="chat-count" data-tone="quiet">
              {on} of {entries.length} on
            </span>
          </h3>
          <p>Capabilities you’ve enabled for this role.</p>
        </div>
        <Button className="text-button" onClick={onConfigure}>
          <SlidersHorizontal size={14} /> Edit
        </Button>
      </div>
      <ul>
        {entries
          .toSorted((a, b) => Number(b.enabled) - Number(a.enabled))
          .map(({ key, label, enabled }) => (
            <li key={key} data-enabled={enabled ? '' : undefined}>
              <span
                className="clay-bead"
                data-size="sm"
                data-tone={enabled ? 'moss' : undefined}
                data-empty={enabled ? undefined : ''}
                aria-hidden="true"
              />
              <span>{label}</span>
              <span className={enabled ? 'enabled' : ''}>{enabled ? 'On' : 'Off'}</span>
            </li>
          ))}
      </ul>
      <p className="chat-approval-note">
        Agents propose instruction and capability changes and suggest skills. You decide whether to
        apply them.
      </p>
    </WorkSection>
  );
};
