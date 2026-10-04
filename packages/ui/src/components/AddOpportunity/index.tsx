import { JobIdentityFields } from '@/components/AddOpportunity/components/JobIdentityFields.tsx';
import { JobLocationFields } from '@/components/AddOpportunity/components/JobLocationFields.tsx';
import { useAddOpportunity } from '@/components/AddOpportunity/hooks/useAddOpportunity.ts';
import { ExternalApplicationFields } from './components/ExternalApplicationFields.tsx';
import type { AddOpportunityProps } from '@/components/AddOpportunity/types.ts';
import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
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
  } = controller;
  return (
    <Modal title={external ? 'Register an application' : 'Add a job post'} onClose={onClose}>
      <p className="modal-intro">
        {external
          ? 'Save an application you already submitted so future updates can be tracked.'
          : 'Scout works from the description, so paste it in if you have it.'}
      </p>
      <form onSubmit={(e) => void submit(e)} className="form flex flex-col gap-4">
        <JobIdentityFields />
        <ExternalApplicationFields external={external} setExternal={setExternal} />
        <label>
          <span className="flex items-baseline gap-2">
            Job post URL <span className="optional">optional</span>
          </span>
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
        <div className="form-footer mt-0.5 flex justify-end gap-2.5 border-t border-border pt-4">
          <Button type="button" className="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="button primary" disabled={working}>
            {working ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}{' '}
            {external ? 'Register application' : 'Add job'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
