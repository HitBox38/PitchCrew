import { capabilityLabels } from '@/agent-capabilities.ts';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import { newAgentCapabilities, toolGroups, toolHelp } from '../constants.ts';
import type { StepProps } from '../types.ts';

export function ToolsStep({ draft, changeRole, data }: StepProps) {
  const capabilities = draft.role.capabilities ?? newAgentCapabilities;
  return (
    <div className="flex flex-col gap-6">
      <p className="quiet">
        Choose only the access this agent needs. It can chat, read your local profile and use its
        assigned skills without extra permissions.
      </p>
      {toolGroups.map((group) => (
        <fieldset key={group.title} className="flex min-w-0 flex-col gap-4">
          <legend className="mb-3 font-semibold">{group.title}</legend>
          {group.keys.map((key) => {
            const service = ['github', 'gmail', 'drive', 'calendar', 'sheets'].includes(key);
            const connected = data.connectors.some(
              (account) => account.connected && account.services.includes(key),
            );
            return (
              <label key={key} className="creation-tool flex items-start gap-3">
                <Checkbox
                  aria-label={capabilityLabels[key]}
                  checked={capabilities[key] ?? false}
                  onCheckedChange={(checked) =>
                    changeRole({ capabilities: { ...capabilities, [key]: checked } })
                  }
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <span>{capabilityLabels[key]}</span>
                  <span className="quiet font-normal">{toolHelp[key]}</span>
                  {service ? (
                    <span className="quiet font-normal">
                      {connected
                        ? 'Account connected'
                        : 'Account not connected. Connect it in Crew settings.'}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </fieldset>
      ))}
      <p className="quiet">
        Exports, browser interactions and submissions need your approval. Agents propose profile,
        instruction and skill changes for you to review.
      </p>
    </div>
  );
}
