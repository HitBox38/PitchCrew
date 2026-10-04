import { FormSelect } from '@/FormSelect/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { boardExamples, providerOptions } from '../constants.ts';
import type { JobSourcesModel, SourceDraft } from '../types.ts';
import { SourceFilters } from './SourceFilters.tsx';
import { SourcePreview } from './SourcePreview.tsx';

export function SourceEditor(model: JobSourcesModel & { draft: SourceDraft }) {
  const { draft, update } = model;
  return (
    <form className="form job-source-editor mt-5 grid gap-4" onSubmit={model.save}>
      <h3>{model.editingId ? `Edit ${draft.name || 'source'}` : 'Add a job source'}</h3>
      <div className="grid grid-cols-2 gap-3.5 max-compact:grid-cols-1">
        <FormSelect
          label="Job board provider"
          value={draft.provider}
          options={providerOptions}
          onValueChange={(provider) => update({ provider })}
        />
        <label>
          Company name
          <Input
            value={draft.name}
            onChange={(event) => update({ name: event.target.value })}
            placeholder="Example Labs"
            required
            maxLength={80}
          />
        </label>
      </div>
      <label>
        Board name or link
        <Input
          value={draft.slug}
          onChange={(event) => model.setBoard(event.target.value)}
          placeholder={boardExamples[draft.provider]}
          required
          maxLength={300}
        />
        <span className="quiet font-normal">
          The name after the provider&apos;s domain in the company&apos;s job board link. Pasting
          the link also works.
        </span>
      </label>
      <SourceFilters draft={draft} update={update} />
      <div className="flex flex-wrap items-center gap-2">
        <Button className="button" type="submit" disabled={model.busy}>
          Save source
        </Button>
        <Button variant="outline" disabled={model.busy || !draft.slug} onClick={model.test}>
          Test source
        </Button>
        <Button variant="ghost" disabled={model.busy} onClick={model.cancel}>
          Cancel
        </Button>
      </div>
      {model.preview ? <SourcePreview preview={model.preview} /> : null}
    </form>
  );
}
