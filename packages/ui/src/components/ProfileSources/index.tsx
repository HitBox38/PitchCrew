import { ProfileMaintenance } from '../ProfileMaintenance/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ConnectAccountDialog } from '@/ConnectorSettings/components/ConnectAccountDialog.tsx';
import { GitBranch, FolderOpen, ExternalLink } from 'lucide-react';
import { SourceForm } from './components/SourceForm.tsx';
import { SourceList } from './components/SourceList.tsx';
import { ImportReview } from './components/ImportReview.tsx';
import type { ProfileSourcesModel } from './types.ts';

export function ProfileSources(c: ProfileSourcesModel) {
  return (
    <section className="profile-sources" aria-label="Profile sources">
      <div className="profile-sources-heading">
        <div>
          <h2>Profile sources</h2>
          <p className="quiet">
            Bring in your work history and project notes from where you keep them.
          </p>
        </div>
        <div className="profile-source-actions">
          <Button
            variant="outline"
            disabled={c.busy}
            onClick={() => {
              c.setProvider('github');
            }}
          >
            <GitBranch size={16} /> GitHub
          </Button>
          <Button
            variant="outline"
            disabled={c.busy}
            onClick={() => {
              c.setProvider('drive');
            }}
          >
            <FolderOpen size={16} /> Google Drive
          </Button>
        </div>
      </div>
      <SourceList {...c} />
      <ProfileMaintenance {...c.maintenance} />
      {c.maintenanceError ? <p role="alert">{c.maintenanceError}</p> : null}
      {c.provider ? <SourceForm {...c} /> : null}
      {c.connection.github?.error ? (
        <p role="alert" className="form-error">
          {c.connection.github.error}
        </p>
      ) : null}
      {c.connection.authorizationUrl && c.connection.google?.pending ? (
        <a className="button" href={c.connection.authorizationUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> Finish Google sign-in
        </a>
      ) : null}
      {!c.sources.length && !c.provider ? (
        <p className="info-note">
          Start with a folder of factual notes: background, work experience and one document per
          project. Keep writing skills and tailored application drafts separate.
        </p>
      ) : null}
      {c.error && !c.preview ? (
        <p role="alert" className="form-error">
          {c.error}
        </p>
      ) : null}
      <p className="profile-sources-footnote">
        Reviewed copies stay on this device. Source connections do not grant agents access to your
        accounts.
      </p>
      <ImportReview {...c} />
      {c.connection.editing ? <ConnectAccountDialog {...c.connection} /> : null}
    </section>
  );
}
