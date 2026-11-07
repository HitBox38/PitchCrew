import type { ManagedRuntimeModel } from '@pitchcrew/core';
export const RuntimeModelIdentity = ({ entry }: { entry: ManagedRuntimeModel }) => (
  <div className="min-w-0 flex-1 basis-52">
    <div className="settings-list-title">
      <span className="font-semibold wrap-anywhere">{entry.label}</span>
      {entry.custom ? <span className="ui-chip">Custom · unverified</span> : null}
    </div>
    <p className="quiet wrap-anywhere">{entry.value}</p>
    {entry.reasoning ? (
      <p className="quiet">
        Reasoning: {entry.reasoning.levels.join(', ')}
        {entry.reasoning.default ? `; default ${entry.reasoning.default}` : ''}
      </p>
    ) : null}
  </div>
);
