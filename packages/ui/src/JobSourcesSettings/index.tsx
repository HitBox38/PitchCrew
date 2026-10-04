import { Button } from '@/components/ui/button/components/Button.tsx';
import { Plus, Radar } from 'lucide-react';
import { ScanSummary } from './components/ScanSummary.tsx';
import { SourceEditor } from './components/SourceEditor.tsx';
import { SourceList } from './components/SourceList.tsx';
import { useJobSources } from './hooks/useJobSources.ts';

export function JobSourcesSettings() {
  const model = useJobSources();
  return (
    <section className="settings-section" aria-labelledby="job-sources-heading">
      <h2 id="job-sources-heading">Job sources</h2>
      <p className="quiet">
        Watch public job boards on Greenhouse, Ashby and Lever. New postings that match your filters
        become leads on the board. Jobs already on the board, including ones you withdrew, are not
        added again.
      </p>
      <div className="settings-row">
        <Button className="button" disabled={model.busy || !!model.draft} onClick={model.startAdd}>
          <Plus size={15} /> Add source
        </Button>
        <Button
          className="button"
          disabled={model.busy || !model.sources.some((source) => source.enabled)}
          onClick={model.scan}
        >
          <Radar size={15} /> Scan now
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
    </section>
  );
}
