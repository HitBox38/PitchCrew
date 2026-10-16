import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export function SourceNotice(c: ProfileSourcesModel) {
  if (!c.notice) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-primary/5 p-3">
      <output className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <CheckCircle2 size={17} className="shrink-0 text-moss" aria-hidden="true" />
        {c.notice.message}
      </output>
      {c.notice.file ? (
        <Button size="sm" disabled={c.busy} onClick={c.openNotice}>
          Open note
        </Button>
      ) : null}
    </div>
  );
}
