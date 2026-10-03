import { useState } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { JobActionsProps } from '../types.ts';

export function ExportRequest({
  card,
  act,
  working,
}: Pick<JobActionsProps, 'card' | 'act' | 'working'>) {
  const [format, setFormat] = useState('markdown');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="quiet">
        Document format
        <select
          value={format}
          onChange={(event) => setFormat(event.target.value)}
          className="ml-2 rounded border p-2"
        >
          <option value="markdown">Markdown</option>
          <option value="pdf">Markdown + PDF</option>
          <option value="docx">Markdown + DOCX</option>
          <option value="both">Markdown + PDF + DOCX</option>
        </select>
      </label>
      <Button
        disabled={working}
        className="button primary"
        onClick={() =>
          act(
            `/cards/${card.id}/approval`,
            {
              formats: format === 'markdown' ? [] : format === 'both' ? ['pdf', 'docx'] : [format],
            },
            'Documents generated for review in Inbox',
          )
        }
      >
        Request export approval
      </Button>
    </div>
  );
}
