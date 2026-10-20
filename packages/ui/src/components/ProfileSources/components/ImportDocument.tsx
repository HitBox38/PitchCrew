import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion/index.tsx';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import type { ProfileImportFile } from '@pitchcrew/core';
import { importStatus } from '../helpers.ts';
import { ImportDocumentPreview } from './ImportDocumentPreview.tsx';

export const ImportDocument = ({
  file,
  selected,
  toggle,
  busy,
  expanded,
}: {
  file: ProfileImportFile;
  selected: boolean;
  toggle: (name: string) => void;
  busy: boolean;
  expanded: boolean;
}) => {
  return (
    <AccordionItem value={file.name} className="profile-import-document" data-status={file.status}>
      <div className="flex items-center gap-1 pr-2" data-selected={selected || undefined}>
        <label className="flex min-h-12 w-10 shrink-0 cursor-pointer items-center justify-center">
          <Checkbox
            aria-label={`Import ${file.path}`}
            checked={selected}
            onCheckedChange={() => toggle(file.name)}
            disabled={busy}
          />
        </label>
        <AccordionTrigger className="min-h-12 min-w-0 flex-1 gap-2 py-2 pr-1 font-sans">
          <span className="min-w-0 flex-1 truncate" title={file.path}>
            {file.path}
          </span>
          <span className="profile-import-status">{importStatus[file.status]}</span>
        </AccordionTrigger>
      </div>
      <AccordionContent>{expanded ? <ImportDocumentPreview file={file} /> : null}</AccordionContent>
    </AccordionItem>
  );
};
