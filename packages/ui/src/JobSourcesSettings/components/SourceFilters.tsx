import { Checkbox } from '@pitchcrew/design-system/checkbox';
import { Input } from '@pitchcrew/design-system/input';
import type { SourceDraft } from '../types.ts';

export const SourceFilters = ({
  draft,
  update,
}: {
  draft: SourceDraft;
  update: (patch: Partial<SourceDraft>) => void;
}) => {
  return (
    <fieldset className="grid gap-3">
      <legend className="settings-legend">Filters</legend>
      <p className="quiet">
        Separate keywords with commas. Leave a field empty to keep every posting.
      </p>
      <div className="settings-field-grid" data-columns="3">
        {fields.map((field) => (
          <label key={field.key}>
            {field.label}
            <Input
              value={draft[field.key]}
              onChange={(event) => update({ [field.key]: event.target.value })}
              placeholder={field.placeholder}
              maxLength={1200}
            />
          </label>
        ))}
      </div>
      <label className="checkbox-label">
        <Checkbox
          checked={draft.remoteOnly}
          onCheckedChange={(checked) => update({ remoteOnly: checked })}
        />
        Remote postings only
      </label>
      <label className="checkbox-label">
        <Checkbox
          checked={draft.enabled}
          onCheckedChange={(checked) => update({ enabled: checked })}
        />
        Watch this source
      </label>
    </fieldset>
  );
};

const fields = [
  { key: 'titleInclude', label: 'Title includes any of', placeholder: 'engineer, developer' },
  { key: 'titleExclude', label: 'Title excludes', placeholder: 'intern, manager' },
  { key: 'locationInclude', label: 'Location includes any of', placeholder: 'remote, Lisbon' },
] as const;
