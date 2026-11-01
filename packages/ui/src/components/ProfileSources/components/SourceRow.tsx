import { FolderOpen, GitBranch, RefreshCw } from 'lucide-react';
import type { ProfileSource } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Switch } from '@/components/ui/switch/index.tsx';
import { sourceLocation } from '../helpers.ts';
import { SourceMenu } from './SourceMenu.tsx';
import { SourceProgress } from './SourceProgress.tsx';
import { SourceProposalLinks } from './SourceProposalLinks.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export const SourceRow = ({
  source,
  controller: c,
}: {
  source: ProfileSource;
  controller: ProfileSourcesModel;
}) => {
  const Icon = source.input.provider === 'github' ? GitBranch : FolderOpen;
  const proposals = c.proposals.filter((p) => p.source.id === source.id);
  const project = source.mode === 'project';
  return (
    <li className="profile-source-row" aria-label={source.label}>
      <span className="profile-source-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className="profile-source-copy">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="profile-source-name">{source.label}</h3>
          <span className="ui-chip">{project ? 'Project watch' : 'Profile notes'}</span>
        </div>
        <p className="profile-source-meta">{sourceLocation(source)}</p>
        <p className="profile-source-meta">
          {project
            ? `Tracking revision ${source.revision?.slice(0, 8) ?? 'unavailable'}`
            : `${source.files.length} ${source.files.length === 1 ? 'document' : 'documents'} · Imported ${new Date(source.importedAt).toLocaleDateString()}`}
        </p>
        {c.progress?.sourceId === source.id ? <SourceProgress label={c.progress.label} /> : null}
      </div>
      <div className="profile-source-actions">
        <label className="profile-source-watch">
          <Switch
            checked={source.watching === true}
            disabled={c.busy}
            aria-label={`Watching ${source.label}`}
            onCheckedChange={(value) => void c.setWatching(source.id, value)}
          />
          Watching <b>{source.watching ? 'On' : 'Off'}</b>
        </label>
        <SourceProposalLinks proposals={proposals} controller={c} />
        {!project ? (
          <Button
            variant="outline"
            size="sm"
            disabled={c.busy}
            onClick={() => void c.load(source.input, source.id)}
          >
            <RefreshCw size={14} aria-hidden="true" /> Review updates
          </Button>
        ) : null}
        <SourceMenu
          label={source.label}
          disabled={c.busy}
          remove={() => void c.unlink(source.id)}
        />
      </div>
    </li>
  );
};
