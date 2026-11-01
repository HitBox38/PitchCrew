import { JobIdentityFields } from './JobIdentityFields.tsx';
import { JobLocationFields } from './JobLocationFields.tsx';
import { ExternalApplicationFields } from './ExternalApplicationFields.tsx';
import { JobLinkField } from './JobLinkField.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import { TagPicker } from '@/TagPicker/index.tsx';
import type { AddOpportunityModel } from '../types.ts';

/** Link and Fetch, company/title, location/salary, the full description, tags, then applied. */
export const OpportunityFields = (model: AddOpportunityModel) => {
  const { card, external, working, lookup, scout, setExternal } = model;
  return (
    <fieldset disabled={working} className="add-job-body">
      {card ? (
        <p className="add-job-note">
          Changing posting details needs a fresh brief and packet review. Tag-only edits keep them.
        </p>
      ) : null}
      <JobLinkField
        lookup={lookup}
        scout={scout}
        working={working}
        external={external}
        editing={!!card}
        close={model.onClose}
      />
      <JobIdentityFields card={card} />
      <JobLocationFields card={card} />
      <label className="add-job-description">
        Job description
        <Textarea
          name="description"
          defaultValue={card?.description}
          rows={8}
          placeholder="Paste the full listing"
          maxLength={20000}
        />
      </label>
      <TagPicker
        value={model.tags}
        onValueChange={model.setTags}
        query={model.tagQuery}
        onQueryChange={model.setTagQuery}
        disabled={working}
      />
      {!card ? (
        <ExternalApplicationFields
          external={external}
          setExternal={setExternal}
          jobIdentifier={lookup.prefill?.jobIdentifier ?? ''}
        />
      ) : null}
      {model.error ? (
        <p className="form-error" role="alert">
          {model.error}
        </p>
      ) : null}
    </fieldset>
  );
};
