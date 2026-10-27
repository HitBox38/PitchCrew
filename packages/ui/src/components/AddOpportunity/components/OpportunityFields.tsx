import { JobIdentityFields } from './JobIdentityFields.tsx';
import { JobLocationFields } from './JobLocationFields.tsx';
import { ExternalApplicationFields } from './ExternalApplicationFields.tsx';
import { JobLinkField } from './JobLinkField.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import { TagPicker } from '@/TagPicker/index.tsx';
import type { AddOpportunityModel } from '../types.ts';

export const OpportunityFields = (model: AddOpportunityModel) => {
  const {
    card,
    external,
    working,
    lookup,
    scout,
    setExternal,
    tags,
    setTags,
    tagQuery,
    setTagQuery,
    error,
  } = model;
  return (
    <fieldset
      disabled={working}
      className="add-job-body flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 max-mobile:px-4"
    >
      <p className="modal-intro">
        {card
          ? 'Update the saved posting details. Changes to posting details require a fresh application brief and packet review.'
          : external
            ? 'Save an application you already submitted so future updates can be tracked.'
            : 'Scout works from the description, so paste it in if you have it.'}
      </p>
      <JobLinkField
        lookup={lookup}
        scout={scout}
        working={working}
        external={external}
        editing={!!card}
      />
      <JobIdentityFields card={card} />
      {!card ? (
        <ExternalApplicationFields
          external={external}
          setExternal={setExternal}
          jobIdentifier={lookup.prefill?.jobIdentifier ?? ''}
        />
      ) : null}
      <JobLocationFields card={card} />
      <label>
        Job description
        <Textarea
          name="description"
          defaultValue={card?.description}
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
    </fieldset>
  );
};
