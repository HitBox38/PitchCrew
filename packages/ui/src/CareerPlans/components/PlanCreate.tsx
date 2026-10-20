import { useState } from 'react';
import { Input } from '@/components/ui/input/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Sheet } from '@/components/ui/sheet/components/Sheet.tsx';
import { SheetContent } from '@/components/ui/sheet/components/SheetContent.tsx';
import { SheetTitle } from '@/components/ui/sheet/components/SheetTitle.tsx';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { PlanJobPicker } from './PlanJobPicker.tsx';

export function PlanCreate({
  change,
  close,
  working,
}: {
  change: (data: Record<string, unknown>) => Promise<unknown>;
  close: () => void;
  working: boolean;
}) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('');
  const [cardIds, setCardIds] = useState<string[]>([]);
  const guard = useUnsavedChanges(!!(name || title || tag || cardIds.length));
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
            className="form flex h-full flex-col gap-4 overflow-y-auto p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void change({ action: 'plan_create', name, scope: { title, tag, cardIds } })
                .then(close)
                .catch(() => {});
            }}
          >
            <SheetTitle>Create a career plan</SheetTitle>
            <label htmlFor="career-plan-name">Plan name</label>
            <Input
              id="career-plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
            <label htmlFor="career-plan-role">Target role contains</label>
            <Input
              id="career-plan-role"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="For example, platform engineer"
              maxLength={120}
            />
            <label htmlFor="career-plan-tag">Job tag</label>
            <Input
              id="career-plan-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              maxLength={80}
            />
            <p className="quiet">
              When combined, filters narrow the selected jobs. Choose at least one filter or
              individual job.
            </p>
            <PlanJobPicker selected={cardIds} change={setCardIds} />
            <div className="mt-auto flex gap-2">
              <Button
                type="submit"
                disabled={
                  working || !name.trim() || !(title.trim() || tag.trim() || cardIds.length)
                }
              >
                Save plan
              </Button>
              <Button disabled={working} onClick={requestClose}>
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      <DiscardChanges guard={guard} />
    </>
  );
}
