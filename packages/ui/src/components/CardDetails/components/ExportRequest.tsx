import { useState } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { JobActionsProps } from '../types.ts';
import { FormSelect } from '@/FormSelect/index.tsx';

export function ExportRequest({
  card,
  act,
  working,
}: Pick<JobActionsProps, 'card' | 'act' | 'working'>) {
  const [format, setFormat] = useState('markdown');
  const [layout, setLayout] = useState('formatted');
  return (
    <div className="flex flex-wrap items-end gap-2">
      <FormSelect
        label="Document format"
        value={format}
        onValueChange={setFormat}
        options={[
          { value: 'markdown', label: 'Markdown' },
          { value: 'pdf', label: 'Markdown + PDF' },
          { value: 'docx', label: 'Markdown + DOCX' },
          { value: 'both', label: 'Markdown + PDF + DOCX' },
        ]}
      />
      <FormSelect
        label="Layout"
        value={layout}
        onValueChange={setLayout}
        disabled={format === 'markdown'}
        options={[
          { value: 'formatted', label: 'Formatted' },
          { value: 'plain', label: 'Plain text' },
        ]}
      />
      <Button
        disabled={working}
        className="button primary"
        onClick={() =>
          act(
            `/cards/${card.id}/approval`,
            {
              formats: format === 'markdown' ? [] : format === 'both' ? ['pdf', 'docx'] : [format],
              layout,
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
