import { Button } from '@/components/ui/button/components/Button.tsx';
import { Plus, Radar } from 'lucide-react';
import { ScanSummary } from './components/ScanSummary.tsx';
import { SourceEditor } from './components/SourceEditor.tsx';
import { SourceList } from './components/SourceList.tsx';
import { useJobSources } from './hooks/useJobSources.ts';
import { maxSources } from './constants.ts';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';

export const JobSourcesSettings = () => {
  const model = useJobSources();
  const full = model.sources.length >= maxSources;
  const watching = model.sources.filter((source) => source.enabled).length;
  return (
    <SettingsSection
      id="job-sources-heading"
      title="Saved job boards"
      count={model.sources.length ? `${watching} of ${model.sources.length} watched` : undefined}
      description={
        full
          ? `${maxSources} boards saved, the most allowed. Remove one to add another.`
          : 'Pitchcrew reads official public Greenhouse, Ashby, Lever, Comeet and Workable boards without signing in. Agents with job discovery can scan them; only you can change them.'
      }
      actions={
        <>
          {model.sources.length ? (
            <Button
              variant="outline"
              size="sm"
              disabled={model.busy || !!model.draft || !watching}
              onClick={model.scan}
            >
              <Radar size={14} aria-hidden="true" />
              {model.busy ? 'Working…' : 'Scan now'}
            </Button>
          ) : null}
          <Button size="sm" disabled={model.busy || !!model.draft || full} onClick={model.startAdd}>
            <Plus size={14} aria-hidden="true" /> Add source
          </Button>
        </>
      }
    >
      {model.draft ? <SourceEditor {...model} draft={model.draft} /> : null}
      {model.error ? (
        <p role="alert" className="form-error">
          {model.error}
        </p>
      ) : null}
      {model.summary ? <ScanSummary summary={model.summary} /> : null}
      <SourceList {...model} />
      <DiscardChanges
        guard={model.guard}
        finalFocus={() => document.querySelector<HTMLElement>('.job-source-editor input') ?? false}
      />
    </SettingsSection>
  );
};
