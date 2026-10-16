import { FolderOpen, GitBranch, RefreshCw } from 'lucide-react';
import type { ProfileSource } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Switch } from '@/components/ui/switch/index.tsx';
import { sourceLocation } from '../helpers.ts';
import { SourceMenu } from './SourceMenu.tsx';
import { SourceProgress } from './SourceProgress.tsx';
import { SourceProposalLinks } from './SourceProposalLinks.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export function SourceRow({
  source,
  controller: c,
}: {
  source: ProfileSource;
  controller: ProfileSourcesModel;
}) {
  const Icon = source.input.provider === 'github' ? GitBranch : FolderOpen;
  const proposals = c.proposals.filter((p) => p.source.id === source.id);
  const project = source.mode === 'project';
  return (
    <li className="grid gap-3 py-5 first:pt-1 last:pb-1" aria-label={source.label}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-primary/5 p-2 text-primary">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-sans text-sm font-semibold wrap-anywhere">{source.label}</h3>
            <span className="profile-source-badge">
              {project ? 'Project watch' : 'Profile notes'}
            </span>
          </div>
          <p className="text-xs leading-relaxed wrap-anywhere text-muted-foreground">
            {sourceLocation(source)}
          </p>
          <p className="text-xs text-muted-foreground">
            {project
              ? `Tracking revision ${source.revision?.slice(0, 8) ?? 'unavailable'}`
              : `${source.files.length} ${source.files.length === 1 ? 'document' : 'documents'} · Imported ${new Date(source.importedAt).toLocaleDateString()}`}
          </p>
        </div>
        <SourceMenu
          label={source.label}
          disabled={c.busy}
          remove={() => void c.unlink(source.id)}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pl-11">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Switch
            checked={source.watching === true}
            disabled={c.busy}
            aria-label={`Watching ${source.label}`}
            onCheckedChange={(value) => void c.watch(source.id, value)}
          />
          Watching{' '}
          <span className="min-w-5 font-semibold text-foreground">
            {source.watching ? 'On' : 'Off'}
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {!project ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={c.busy}
              onClick={() => void c.load(source.input, source.id)}
            >
              <RefreshCw size={14} /> Review updates
            </Button>
          ) : null}
          <SourceProposalLinks proposals={proposals} controller={c} />
        </div>
      </div>
      {c.progress?.sourceId === source.id ? (
        <div className="pl-11">
          <SourceProgress label={c.progress.label} />
        </div>
      ) : null}
    </li>
  );
}
