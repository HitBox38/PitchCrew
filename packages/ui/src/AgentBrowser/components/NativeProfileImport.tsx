import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { NativeProfilesModel } from '../hooks/useNativeProfiles.ts';
export const NativeProfileImport = ({ model }: { model: NativeProfilesModel }) => {
  const [confirmed, setConfirmed] = useState(false);
  const preview = model.state!.preview!;
  return (
    <div className="space-y-3">
      <p>
        Import {preview.count} cookies into <strong>{preview.profileName}</strong>?
      </p>
      <p className="quiet">
        This copies website sign-ins once. It may replace matching cookies. Later changes stay
        separate. Unsupported partitioned and expired cookies skipped: {preview.skipped}.
      </p>
      <ul className="max-h-40 overflow-auto rounded border border-border p-3">
        {preview.domains.map((domain) => (
          <li key={domain}>{domain}</li>
        ))}
      </ul>
      <label className="flex items-start gap-2">
        <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />I
        want this agent’s browser profile to use these website sessions.
      </label>
      <div className="flex justify-end gap-2">
        <Button
          disabled={model.working}
          variant="outline"
          onClick={() => void model.run({ kind: 'cancel-import', token: preview.token })}
        >
          Cancel import
        </Button>
        <Button
          disabled={model.working || !confirmed}
          onClick={() => void model.run({ kind: 'confirm-import', token: preview.token })}
        >
          Import reviewed sessions
        </Button>
      </div>
    </div>
  );
};
