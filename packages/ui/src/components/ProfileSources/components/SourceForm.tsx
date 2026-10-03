import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export function SourceForm(c: ProfileSourcesModel) {
  return (
    <form className="profile-source-form" onSubmit={c.previewSource}>
      <h3>
        {c.provider === 'github' ? 'Read from a GitHub folder' : 'Read from a Google Drive folder'}
      </h3>
      {c.provider === 'github' ? (
        <>
          <label>
            Repository URL or owner/repository
            <Input
              value={c.repository}
              onChange={(e) => c.setRepository(e.target.value)}
              placeholder="https://github.com/owner/resumes"
              required
              maxLength={300}
            />
          </label>
          <div className="profile-source-fields">
            <label>
              Profile folder
              <Input
                value={c.path}
                onChange={(e) => c.setPath(e.target.value)}
                placeholder="about-me"
                maxLength={500}
              />
            </label>
            <label>
              Branch or tag (optional)
              <Input
                value={c.branch}
                onChange={(e) => c.setBranch(e.target.value)}
                placeholder="Default branch"
                maxLength={200}
              />
            </label>
          </div>
          <p className="quiet">
            Choose your factual source folder. Nested work histories and projects stay separate. Add
            a second source for a general resume.
          </p>
        </>
      ) : (
        <>
          <label>
            Google Drive folder link
            <Input
              value={c.folder}
              onChange={(e) => c.setFolder(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
              required
              maxLength={500}
            />
          </label>
          <p className="quiet">
            Reads Google Docs, Markdown and text documents, including nested folders. PDFs and
            shortcuts are skipped.
          </p>
        </>
      )}
      {!c.canRead ? (
        <div className="profile-source-connect">
          <p className="quiet">
            {c.provider === 'github'
              ? 'Connect GitHub with read access to this repository.'
              : 'Connect Google and grant Drive read access.'}
          </p>
          <Button
            disabled={c.busy}
            onClick={() => c.connection.setEditing(c.provider === 'github' ? 'github' : 'google')}
          >
            {c.provider === 'github' ? 'Connect GitHub' : 'Connect Google Drive'}
          </Button>
        </div>
      ) : null}
      <div className="form-footer mt-0.5 flex justify-end gap-2.5 border-t border-border pt-4">
        <Button variant="outline" disabled={c.busy} onClick={() => c.setProvider(null)}>
          Cancel
        </Button>
        <Button type="submit" disabled={c.busy || !c.canRead}>
          {c.busy ? 'Reading documents…' : 'Review documents'}
        </Button>
      </div>
    </form>
  );
}
