import { JobIdentityFields } from '@/components/AddOpportunity/components/JobIdentityFields.tsx';
import { JobLocationFields } from '@/components/AddOpportunity/components/JobLocationFields.tsx';
import { useAddOpportunity } from '@/components/AddOpportunity/hooks/useAddOpportunity.ts';
import { ExternalApplicationFields } from './components/ExternalApplicationFields.tsx';
import { JobLinkField } from './components/JobLinkField.tsx';
import type { AddOpportunityProps } from '@/components/AddOpportunity/types.ts';
import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import { TagPicker } from '@/TagPicker/index.tsx';
import { LoaderCircle, Plus } from 'lucide-react';

export function AddOpportunity(props: AddOpportunityProps) {
  const controller = useAddOpportunity(props);
  const {
    working,
    onClose,
    error,
    submit,
    external,
    setExternal,
    tags,
    setTags,
    tagQuery,
    setTagQuery,
    lookup,
  } = controller;
  return (
    <Modal
      title={external ? 'Register an application' : 'Add a job post'}
      onClose={onClose}
      className="add-job-panel"
    >
      <form onSubmit={(e) => void submit(e)} className="form flex min-h-0 flex-1 flex-col gap-0">
        <div className="add-job-body flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 max-mobile:px-4">
          <p className="modal-intro">
            {external
              ? 'Save an application you already submitted so future updates can be tracked.'
              : 'Scout works from the description, so paste it in if you have it.'}
          </p>
          <JobLinkField lookup={lookup} working={working} />
          <JobIdentityFields />
          <ExternalApplicationFields
            external={external}
            setExternal={setExternal}
            jobIdentifier={lookup.prefill?.jobIdentifier ?? ''}
          />
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
          <TagPicker
            value={tags}
            onValueChange={setTags}
            query={tagQuery}
            onQueryChange={setTagQuery}
            disabled={working}
          />
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="add-job-footer flex shrink-0 justify-end gap-2.5 border-t border-border px-5 py-4 max-mobile:px-4">
          <Button type="button" className="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="button primary" disabled={working || lookup.pending}>
            {working ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}{' '}
            {external ? 'Register application' : 'Add job'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
