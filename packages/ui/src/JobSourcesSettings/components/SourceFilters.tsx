import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import type { SourceDraft } from '../types.ts';

const fields = [
  { key: 'titleInclude', label: 'Title includes any of', placeholder: 'engineer, developer' },
  { key: 'titleExclude', label: 'Title excludes', placeholder: 'intern, manager' },
  { key: 'locationInclude', label: 'Location includes any of', placeholder: 'remote, Lisbon' },
] as const;

export function SourceFilters({
  draft,
  update,
}: {
  draft: SourceDraft;
  update: (patch: Partial<SourceDraft>) => void;
}) {
  return (
    <fieldset className="grid gap-3.5">
      <legend className="mb-2 font-semibold">Filters</legend>
      <p className="quiet">
        Separate keywords with commas. Leave a field empty to keep every posting.
      </p>
      <div className="grid grid-cols-3 gap-3.5 max-compact:grid-cols-1">
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
        Include in scans
      </label>
    </fieldset>
  );
}
