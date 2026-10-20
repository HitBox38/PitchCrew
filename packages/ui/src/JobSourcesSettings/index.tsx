import { Button } from '@/components/ui/button/components/Button.tsx';
import { Plus, Radar } from 'lucide-react';
import { ScanSummary } from './components/ScanSummary.tsx';
import { SourceEditor } from './components/SourceEditor.tsx';
import { SourceList } from './components/SourceList.tsx';
import { useJobSources } from './hooks/useJobSources.ts';
import { SettingsIntro } from '@/SettingsPage/components/SettingsIntro.tsx';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';

export const JobSourcesSettings = () => {
  const model = useJobSources();
  return (
    <section className="settings-section" aria-labelledby="job-sources-heading">
      <SettingsIntro
        id="job-sources-heading"
        title="Job sources"
        description="Watch company job boards and bring matching postings into your pipeline. Existing jobs stay on the board without being added again."
        actions={
          <Button disabled={model.busy || !!model.draft} onClick={model.startAdd}>
            <Plus size={15} aria-hidden="true" /> Add source
          </Button>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="quiet">
          <strong>{model.sources.filter((source) => source.enabled).length}</strong> watching ·{' '}
          {model.sources.length} saved sources
        </p>
        <Button
          variant="outline"
          disabled={model.busy || !!model.draft || !model.sources.some((source) => source.enabled)}
          onClick={model.scan}
        >
          <Radar size={15} aria-hidden="true" />
          {model.busy ? 'Working…' : 'Scan now'}
        </Button>
      </div>
      {model.draft ? <SourceEditor {...model} draft={model.draft} /> : null}
      {model.error ? (
        <p role="alert" className="form-error mt-4">
          {model.error}
        </p>
      ) : null}
      {model.summary ? <ScanSummary summary={model.summary} /> : null}
      <SourceList {...model} />
      <p className="info-note mt-5">
        Pitchcrew reads only the official public job board APIs, without signing in. Agents with job
        discovery enabled can scan these sources, for example from a routine. Only you can add,
        change or remove them.
      </p>
      <DiscardChanges
        guard={model.guard}
        finalFocus={() => document.querySelector<HTMLElement>('.job-source-editor input') ?? false}
      />
    </section>
  );
};
