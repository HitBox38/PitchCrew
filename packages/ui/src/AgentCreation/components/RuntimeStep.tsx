import { RuntimeSettings } from '@/components/RoleSettings/components/RuntimeSettings.tsx';
import { runtimeLabels } from '@/lib/labels.ts';
import type { StepProps } from '../types.ts';

export function RuntimeStep({ draft, changeRole, data }: StepProps) {
  const role = draft.role;
  const catalog = data.runtimes.find((runtime) => runtime.id === role.runtime);
  if (!catalog)
    return (
      <p role="alert">The selected runtime is no longer available. Close setup and try again.</p>
    );
  return (
    <div className="flex flex-col gap-5">
      <p className="quiet">
        Pitchcrew runs an installed CLI for this agent. Your CLI keeps its own sign-in and model
        settings.
      </p>
      <RuntimeSettings
        role={{ ...role, id: 'new-agent' }}
        runtime={role.runtime}
        model={role.model}
        enabled={role.enabled}
        setEnabled={(value) =>
          changeRole({ enabled: typeof value === 'function' ? value(role.enabled) : value })
        }
        setRuntime={(value) =>
          changeRole({
            runtime: typeof value === 'function' ? value(role.runtime) : value,
            model: '',
          })
        }
        setModel={(value) =>
          changeRole({ model: typeof value === 'function' ? value(role.model) : value })
        }
        runtimeItems={data.runtimes.map((runtime) => ({
          value: runtime.id,
          label: `${runtimeLabels[runtime.id]}${runtime.available ? '' : ' (unavailable)'}`,
        }))}
        runtimeAvailable={catalog.available}
        runtimeCatalog={catalog}
      />
      {role.runtime === 'demo' ? (
        <p className="quiet">
          Demo returns fictional, deterministic results. Select an installed runtime for live agent
          work.
        </p>
      ) : null}
      {!catalog.available ? (
        <p className="quiet">
          You can create this agent paused and install its runtime before enabling it.
        </p>
      ) : null}
    </div>
  );
}
