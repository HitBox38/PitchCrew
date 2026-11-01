import { Button } from '@pitchcrew/design-system/button';
import { Input } from '@pitchcrew/design-system/input';
import type { NativeProfilesModel } from '../hooks/useNativeProfiles.ts';
export const NativeProfileCreate = ({ model }: { model: NativeProfilesModel }) => (
  <form
    className="flex gap-2"
    onSubmit={(event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const name = String(new FormData(form).get('name') ?? '').trim();
      if (name)
        void model.run({ kind: 'create', name }).then((saved) => {
          if (saved) form.reset();
        });
    }}
  >
    <Input
      name="name"
      aria-label="New browser profile name"
      placeholder="New profile name"
      maxLength={60}
      disabled={model.working}
      required
    />
    <Button type="submit" disabled={model.working || (model.state?.profiles.length ?? 0) >= 20}>
      Create profile
    </Button>
  </form>
);
