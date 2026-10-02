import { capabilityDefaults, capabilityLabels } from '@/agent-capabilities.ts';
import type { CapabilityChangesProps } from '../types.ts';

export function CapabilityChanges({ current, changes }: CapabilityChangesProps) {
  return (
    <ul className="chat-capability-changes">
      {Object.entries(changes).map(([key, enabled]) => {
        const capability = key as keyof typeof capabilityLabels;
        const before = current.capabilities?.[capability] ?? capabilityDefaults[capability];
        return (
          <li key={key}>
            <span>{capabilityLabels[capability]}</span>
            <span>
              <span className="quiet">{before ? 'Enabled' : 'Disabled'}</span>
              <span aria-hidden="true"> → </span>
              <strong>{enabled ? 'Enabled' : 'Disabled'}</strong>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
