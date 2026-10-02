import { capabilityDefaults, capabilityLabels } from '@/agent-capabilities.ts';
import type { RoleCapabilitiesProps } from '@/ChatWork/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { SlidersHorizontal } from 'lucide-react';

export function RoleCapabilities({ role, onConfigure }: RoleCapabilitiesProps) {
  return (
    <section className="chat-work-section chat-role-summary">
      <div className="chat-work-heading">
        <div>
          <h3>How {role.name} works</h3>
          <p>Capabilities you’ve enabled for this role.</p>
        </div>
        <Button className="text-button" onClick={onConfigure}>
          <SlidersHorizontal size={14} /> Edit
        </Button>
      </div>
      <ul>
        {Object.entries(capabilityLabels).map(([key, label]) => {
          const enabled =
            role.capabilities?.[key as keyof typeof capabilityLabels] ??
            capabilityDefaults[key as keyof typeof capabilityLabels];
          return (
            <li key={key}>
              <span>{label}</span>
              <span className={enabled ? 'enabled' : ''}>{enabled ? 'Enabled' : 'Disabled'}</span>
            </li>
          );
        })}
      </ul>
      <p className="chat-approval-note">
        Agents propose instruction and capability changes and suggest skills. You decide whether to
        apply them.
      </p>
    </section>
  );
}
