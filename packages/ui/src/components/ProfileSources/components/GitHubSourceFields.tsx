import { Input } from '@/components/ui/input/components/Input.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export function GitHubSourceFields(c: ProfileSourcesModel) {
  const project = c.intent === 'project';
  return (
    <>
      <label className="grid gap-2 text-sm">
        Repository URL or owner/repository
        <Input
          value={c.repository}
          onChange={(e) => c.setRepository(e.target.value)}
          placeholder={
            project ? 'https://github.com/owner/project' : 'https://github.com/owner/profile-notes'
          }
          required
          maxLength={300}
        />
      </label>
      <div className="grid gap-4 compact:grid-cols-2">
        <label className="grid gap-2 text-sm">
          {project ? 'Project folder (optional)' : 'Profile notes folder'}
          <Input
            value={c.path}
            onChange={(e) => c.setPath(e.target.value)}
            placeholder={project ? 'Entire repository' : 'about-me'}
            maxLength={500}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Branch or tag (optional)
          <Input
            value={c.branch}
            onChange={(e) => c.setBranch(e.target.value)}
            placeholder="Default branch"
            maxLength={200}
          />
        </label>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {project
          ? 'Leave the folder empty to allow investigation across the repository. Watching imports no documents and requires an enabled agent with GitHub and profile maintenance permission.'
          : 'Choose factual notes about your background and work. Markdown and text files in nested folders are included. You will review documents before importing.'}
      </p>
    </>
  );
}
