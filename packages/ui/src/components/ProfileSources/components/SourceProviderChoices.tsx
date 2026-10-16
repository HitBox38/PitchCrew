import { FolderOpen, GitBranch } from 'lucide-react';
import { SourceChoice } from './SourceChoice.tsx';
import type { SourceProvider } from '../types.ts';

export function SourceProviderChoices({
  choose,
  disabled,
}: {
  choose: (provider: SourceProvider) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 compact:grid-cols-2">
      <SourceChoice
        icon={GitBranch}
        title="GitHub"
        description="Import profile notes or watch a project's code changes."
        choose={() => choose('github')}
        disabled={disabled}
        focusKey="add"
      />
      <SourceChoice
        icon={FolderOpen}
        title="Google Drive"
        description="Import Google Docs, Markdown and text from a folder."
        choose={() => choose('drive')}
        disabled={disabled}
      />
    </div>
  );
}
