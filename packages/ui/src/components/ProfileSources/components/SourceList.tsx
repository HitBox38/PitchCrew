import { Button } from '@/components/ui/button/components/Button.tsx';
import { GitBranch, FolderOpen, RefreshCw, Unlink } from 'lucide-react';
import type { ProfileSourcesModel } from '../types.ts';

export function SourceList({ sources, busy, load, unlink }: ProfileSourcesModel) {
  return (
    <div className="profile-source-list">
      {sources.map((source) => (
        <div className="profile-source-row" key={source.id}>
          {source.input.provider === 'github' ? <GitBranch size={18} /> : <FolderOpen size={18} />}
          <div className="profile-source-description">
            <strong>{source.label}</strong>
            <span>
              {source.files.length} documents · Imported{' '}
              {new Date(source.importedAt).toLocaleDateString()}
            </span>
          </div>
          <Button variant="outline" disabled={busy} onClick={() => void load(source.input)}>
            <RefreshCw size={14} /> Review updates
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void unlink(source.id)}
            aria-label={`Remove source ${source.label}; keep local notes`}
          >
            <Unlink size={15} />
          </Button>
        </div>
      ))}
    </div>
  );
}
