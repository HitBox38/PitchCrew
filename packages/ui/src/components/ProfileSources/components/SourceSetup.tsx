import { Code2, FileText } from 'lucide-react';
import { SourceChoice } from './SourceChoice.tsx';
import { SourceProviderChoices } from './SourceProviderChoices.tsx';
import { SourceForm } from './SourceForm.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export const SourceSetup = (c: ProfileSourcesModel) => {
  if (!c.provider) return <SourceProviderChoices choose={c.chooseProvider} disabled={c.busy} />;
  if (c.provider === 'github' && !c.intent)
    return (
      <div className="grid gap-3">
        <SourceChoice
          icon={FileText}
          title="Import profile notes"
          description="Copy personal documents into Profile after review. You can enable watching later."
          choose={() => c.chooseIntent('notes')}
          disabled={c.busy}
        />
        <SourceChoice
          icon={Code2}
          title="Watch a project"
          description="Let an authorized agent investigate code changes and propose notes for your review."
          choose={() => c.chooseIntent('project')}
          disabled={c.busy}
        />
      </div>
    );
  return <SourceForm {...c} />;
};
