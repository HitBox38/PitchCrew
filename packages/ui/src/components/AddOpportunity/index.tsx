import { JobIdentityFields } from '@/components/AddOpportunity/components/JobIdentityFields.tsx';
import { JobLocationFields } from '@/components/AddOpportunity/components/JobLocationFields.tsx';
import { useAddOpportunity } from '@/components/AddOpportunity/hooks/useAddOpportunity.ts';
import type { AddOpportunityProps } from '@/components/AddOpportunity/types.ts';
import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import { LoaderCircle, Plus } from 'lucide-react';

export function AddOpportunity(props: AddOpportunityProps) {
  const controller = useAddOpportunity(props);
  const { working, onClose, error, submit } = controller;
  return (
    <Modal title="Add a job post" onClose={onClose}>
      <p className="modal-intro">
        Scout works from the description, so paste it in if you have it.
      </p>
      <form onSubmit={(e) => void submit(e)} className="form flex flex-col gap-4">
        <JobIdentityFields />
        <label>
          Job post URL <span className="optional">optional</span>
          <Input name="url" type="url" placeholder="https://…" />
        </label>
        <JobLocationFields />
        <label>
          Job description
          <Textarea
            name="description"
            rows={5}
            placeholder="Paste the full listing"
            maxLength={20000}
          />
        </label>
        <label>
          Tags <span className="optional">comma separated, up to 10</span>
          <Input name="tags" placeholder="React, TypeScript, Remote" />
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-footer mt-0.5 flex justify-end gap-2.5 border-t border-border pt-4">
          <Button type="button" className="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="button primary" disabled={working}>
            {working ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Add job
          </Button>
        </div>
      </form>
    </Modal>
  );
}
