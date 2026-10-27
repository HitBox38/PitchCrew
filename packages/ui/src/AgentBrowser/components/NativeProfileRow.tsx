import { useState } from 'react';
import { Input } from '@/components/ui/input/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { NativeProfilesModel } from '../hooks/useNativeProfiles.ts';
export const NativeProfileRow = ({
  profile,
  model,
}: {
  profile: { id: string; name: string };
  model: NativeProfilesModel;
}) => {
  const [remove, setRemove] = useState(false);
  const current = model.state?.currentId === profile.id;
  const selected = model.state?.selectedId === profile.id;
  return (
    <section
      className="space-y-2 rounded border border-border p-3"
      aria-label={`Browser profile ${profile.name}`}
    >
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
          if (name) void model.run({ kind: 'rename', id: profile.id, name });
        }}
      >
        <Input
          key={profile.name}
          name="name"
          defaultValue={profile.name}
          maxLength={60}
          aria-label={`Name for ${profile.name}`}
          disabled={model.working}
          required
        />
        <Button type="submit" size="sm" disabled={model.working}>
          Save name
        </Button>
      </form>
      <p className="quiet">
        {current ? 'Used by this browser. ' : ''}
        {selected ? 'Default for new browser sessions.' : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={model.working || selected}
          onClick={() => void model.run({ kind: 'select', id: profile.id })}
        >
          Use for new sessions
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={model.working}
          onClick={() => void model.run({ kind: 'begin-import', id: profile.id })}
        >
          Import sessions
        </Button>
        {profile.id !== 'default' && !current ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={model.working}
            onClick={() => setRemove(true)}
          >
            Remove profile
          </Button>
        ) : null}
      </div>
      {remove ? (
        <div className="space-y-2" role="alert">
          <p>Remove {profile.name} and its saved website sign-ins?</p>
          <Button
            size="sm"
            variant="destructive"
            disabled={model.working}
            onClick={() => void model.run({ kind: 'remove', id: profile.id })}
          >
            Confirm removal
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRemove(false)}>
            Cancel removal
          </Button>
        </div>
      ) : null}
    </section>
  );
};
