import { ChevronRight, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@pitchcrew/design-system/dialog';
import { useNativeProfiles } from '../hooks/useNativeProfiles.ts';
import { NativeProfileRow } from './NativeProfileRow.tsx';
import { NativeProfileCreate } from './NativeProfileCreate.tsx';
import { NativeProfileImport } from './NativeProfileImport.tsx';
export const NativeBrowserProfiles = ({
  id,
  disabled,
  prepare,
  profile = 'Default',
}: {
  id: string;
  disabled: boolean;
  prepare?: () => Promise<unknown>;
  /** The current profile's name, shown at the row's end. */
  profile?: string;
}) => {
  const [open, setOpen] = useState(false);
  const model = useNativeProfiles(id, prepare);
  const close = (value: boolean) => {
    if (model.working) return;
    if (!value && model.state?.preview)
      void model.run({ kind: 'cancel-import', token: model.state.preview.token });
    setOpen(value);
  };
  return (
    <>
      <Button
        className="browser-menu-row"
        size="sm"
        variant="ghost"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          void model.run({ kind: 'list' });
        }}
      >
        <UserRound size={14} aria-hidden="true" />
        Manage browser profiles
        <span className="browser-menu-row-value" aria-hidden="true">
          {profile}
        </span>
        <ChevronRight size={14} aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="modal max-h-[80vh] overflow-y-auto">
          <DialogTitle>Browser profiles</DialogTitle>
          <DialogDescription>
            Profiles keep separate website sign-ins for this agent. Choosing a default applies to
            newly opened sessions; existing tabs keep their profile. Import JSON or Netscape cookie
            exports with a review before copying.
          </DialogDescription>
          {model.error ? (
            <p className="form-error" role="alert">
              {model.error}
            </p>
          ) : null}
          {model.state?.imported ? (
            <output>Imported {model.state.imported} website cookies.</output>
          ) : null}
          {model.state?.preview ? (
            <NativeProfileImport key={model.state.preview.token} model={model} />
          ) : (
            <div className="space-y-3">
              {model.state?.profiles.map((profile) => (
                <NativeProfileRow key={profile.id} profile={profile} model={model} />
              ))}
              <NativeProfileCreate model={model} />
            </div>
          )}
          <Button variant="outline" disabled={model.working} onClick={() => close(false)}>
            Close profiles
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
