import { useRef } from 'react';
import { OpportunityFields } from './components/OpportunityFields.tsx';
import { useAddOpportunity } from '@/components/AddOpportunity/hooks/useAddOpportunity.ts';
import type { AddOpportunityProps } from '@/components/AddOpportunity/types.ts';
import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { LoaderCircle } from 'lucide-react';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';

/** Add job / Edit job: a 640px form dialog with a pinned Cancel and save footer. */
export const AddOpportunity = (props: AddOpportunityProps) => {
  const controller = useAddOpportunity(props);
  const { card, guard, markDirty, working, onClose, submit, external, lookup } = controller;
  const form = useRef<HTMLFormElement>(null);
  // A new job starts in its first field, the posting link. Touch keeps the dialog's default so
  // opening it never raises the keyboard; Edit job keeps the default too.
  const firstField = (type: string) =>
    type === 'touch' || card
      ? true
      : (form.current?.querySelector<HTMLInputElement>('input[name="url"]:not(:disabled)') ?? true);
  return (
    <Modal
      title={card ? 'Edit job' : 'Add job'}
      onClose={onClose}
      className="add-job-panel"
      initialFocus={firstField}
    >
      <form
        ref={form}
        onChange={markDirty}
        onSubmit={(e) => void submit(e)}
        className="form add-job-form"
      >
        <OpportunityFields {...controller} />
        <div className="ui-footer-bar add-job-footer">
          <span className="ui-footer-note">
            {external ? 'Records your submission. Nothing is sent.' : ''}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={working}>
            Cancel
          </Button>
          <Button type="submit" disabled={working || lookup.pending || !!props.saveBlocker}>
            {working ? <LoaderCircle className="spin" size={15} /> : null}
            {card ? 'Save changes' : external ? 'Register application' : 'Add job'}
          </Button>
        </div>
      </form>
      <DiscardChanges guard={guard} />
    </Modal>
  );
};
