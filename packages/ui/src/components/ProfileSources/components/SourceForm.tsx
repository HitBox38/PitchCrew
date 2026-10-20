import { Input } from '@/components/ui/input/components/Input.tsx';
import { GitHubSourceFields } from './GitHubSourceFields.tsx';
import { SourceActions } from './SourceActions.tsx';
import { SourceConnection } from './SourceConnection.tsx';
import { SourceProgress } from './SourceProgress.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export const SourceForm = (c: ProfileSourcesModel) => {
  return (
    <form className="grid gap-5" onSubmit={c.previewSource} aria-busy={!!c.progress}>
      <fieldset disabled={c.busy} className="grid min-w-0 gap-4">
        <legend className="sr-only">Source details</legend>
        {c.provider === 'github' ? (
          <GitHubSourceFields {...c} />
        ) : (
          <>
            <label className="grid gap-2 text-sm">
              Google Drive folder link
              <Input
                value={c.folder}
                onChange={(e) => c.setFolder(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/…"
                required
                maxLength={500}
              />
            </label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Reads Google Docs, Markdown and text documents, including nested folders. PDFs and
              shortcuts are skipped. You will review documents before importing.
            </p>
          </>
        )}
      </fieldset>
      <SourceConnection {...c} />
      {c.progress ? <SourceProgress label={c.progress.label} /> : null}
      {c.error && !c.preview ? (
        <p role="alert" className="form-error">
          {c.error}
        </p>
      ) : null}
      <SourceActions {...c} />
    </form>
  );
};
