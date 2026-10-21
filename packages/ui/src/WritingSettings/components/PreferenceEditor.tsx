import { useState } from 'react';
import type { WritingPreference } from '@pitchcrew/core';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { Sheet } from '@/components/ui/sheet/components/Sheet.tsx';
import { SheetTitle } from '@/components/ui/sheet/components/SheetTitle.tsx';
import { SheetContent } from '@/components/ui/sheet/components/SheetContent.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Textarea } from '@/components/ui/textarea/index.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import { writingScopes } from '@/lib/application-quality.ts';

export const PreferenceEditor = ({
  preference,
  revision,
  change,
  close,
  working,
}: {
  preference: WritingPreference | null;
  revision: number;
  change: (data: Record<string, unknown>) => Promise<unknown>;
  close: () => void;
  working: boolean;
}) => {
  const [text, setText] = useState(preference?.text ?? '');
  const [scope, setScope] = useState<WritingPreference['scope']>(preference?.scope ?? 'all');
  // react-doctor-disable-next-line react-doctor/no-derived-useState -- Keep the opening revision for conflict detection when saving this draft.
  const [baseRevision] = useState(revision);
  const guard = useUnsavedChanges(
    text !== (preference?.text ?? '') || scope !== (preference?.scope ?? 'all'),
  );
  const requestClose = () => guard.requestLeave(close);
  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open && !working) requestClose();
        }}
      >
        <SheetContent className="role-settings-panel" showCloseButton={false}>
          <form
            className="form flex h-full flex-col gap-4 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void change({
                action: 'preference',
                revision: baseRevision,
                id: preference?.id,
                text,
                scope,
              })
                .then(close)
                .catch(() => {});
            }}
          >
            <SheetTitle>
              {preference ? 'Edit writing preference' : 'Add writing preference'}
            </SheetTitle>
            <label htmlFor="writing-preference-text">Preference</label>
            <Textarea
              id="writing-preference-text"
              rows={5}
              maxLength={1000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
            <FormSelect
              label="Applies to"
              value={scope}
              onValueChange={(value) => setScope(value as WritingPreference['scope'])}
              options={Object.entries(writingScopes).map(([value, label]) => ({ value, label }))}
            />
            <div className="mt-auto flex justify-end gap-2">
              <Button className="button" disabled={working} onClick={requestClose}>
                Cancel
              </Button>
              <Button className="button primary" type="submit" disabled={working || !text.trim()}>
                Save preference
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      <DiscardChanges guard={guard} />
    </>
  );
};
