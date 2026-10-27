import { OpportunityFields } from './components/OpportunityFields.tsx';
import { useAddOpportunity } from '@/components/AddOpportunity/hooks/useAddOpportunity.ts';
import type { AddOpportunityProps } from '@/components/AddOpportunity/types.ts';
import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { LoaderCircle, Plus, Save } from 'lucide-react';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';

export const AddOpportunity = (props: AddOpportunityProps) => {
  const controller = useAddOpportunity(props);
  const { card, guard, markDirty, working, onClose, submit, external, lookup } = controller;
  return (
    <Modal
      title={card ? 'Edit job' : external ? 'Register an application' : 'Add a job post'}
      onClose={onClose}
      className="add-job-panel"
    >
      <form
        onChange={markDirty}
        onSubmit={(e) => void submit(e)}
        className="form flex min-h-0 flex-1 flex-col gap-0"
      >
        <OpportunityFields {...controller} />
        <div className="add-job-footer flex shrink-0 justify-end gap-2.5 border-t border-border px-5 py-4 max-mobile:px-4">
          <Button type="button" className="button" onClick={onClose} disabled={working}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="button primary"
            disabled={working || lookup.pending || !!props.saveBlocker}
          >
            {working ? (
              <LoaderCircle className="spin" size={15} />
            ) : card ? (
              <Save size={15} />
            ) : (
              <Plus size={15} />
            )}{' '}
            {card ? 'Save changes' : external ? 'Register application' : 'Add job'}
          </Button>
        </div>
      </form>
      <DiscardChanges guard={guard} />
    </Modal>
  );
};
