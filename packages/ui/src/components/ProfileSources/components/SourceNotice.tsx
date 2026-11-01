import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export const SourceNotice = (c: ProfileSourcesModel) => {
  if (!c.notice) return null;
  return (
    <div className="profile-source-notice">
      <output className="flex min-w-0 flex-1 items-center gap-2 text-label">
        <CheckCircle2 size={17} className="shrink-0 text-moss" aria-hidden="true" />
        {c.notice.message}
      </output>
      {c.notice.file ? (
        <Button variant="outline" size="sm" disabled={c.busy} onClick={c.openNotice}>
          Open note
        </Button>
      ) : null}
    </div>
  );
};
