import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export const SourceConnection = (c: ProfileSourcesModel) => {
  return (
    <>
      {!c.canRead ? (
        <div className="grid gap-3 rounded-lg bg-primary/5 p-4 text-sm">
          <p className="text-muted-foreground">
            {c.provider === 'github'
              ? 'Connect GitHub with read access to this repository.'
              : 'Connect Google and grant Drive read access.'}
          </p>
          <Button
            variant="outline"
            className="w-fit"
            disabled={c.busy}
            onClick={() => void c.connection.open(c.provider === 'github' ? 'github' : 'google')}
          >
            {c.provider === 'github' ? 'Connect GitHub' : 'Connect Google Drive'}
          </Button>
        </div>
      ) : null}
      {c.connection.github?.error ? (
        <p role="alert" className="form-error">
          {c.connection.github.error}
        </p>
      ) : null}
      {c.connection.authorizationUrl && c.connection.google?.pending ? (
        <a
          className="button w-fit"
          href={c.connection.authorizationUrl}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={14} /> Finish Google sign-in
        </a>
      ) : null}
    </>
  );
};
