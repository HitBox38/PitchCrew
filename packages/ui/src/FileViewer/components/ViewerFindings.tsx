import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { keyedItems } from '@/lib/list-keys.ts';
import { notesLabel } from '@/lib/document-findings.ts';
import type { ViewerFile } from '../types.ts';

/** The file's layout notes as one collapsed row, rose when any is an error, ochre otherwise. */
export const ViewerFindings = ({ file }: { file: ViewerFile }) => {
  if (!file.findings?.length) return null;
  const severity = file.findings.some((finding) => finding.severity === 'error')
    ? 'error'
    : 'warning';
  return (
    <AccordionSection
      className="file-layout-notes"
      triggerClassName="file-layout-notes-trigger"
      contentClassName="file-layout-notes-content"
      heading={
        <>
          <i className="file-note-dot" data-severity={severity} aria-hidden="true" />
          {notesLabel(file.findings)}
        </>
      }
    >
      <ul>
        {keyedItems(file.findings, (finding) => JSON.stringify(finding)).map(({ item, key }) => (
          <li key={key} data-severity={item.severity}>
            <span className="sr-only">{item.severity === 'error' ? 'Error: ' : 'Warning: '}</span>
            {item.page ? <span className="file-layout-note-page">Page {item.page}</span> : null}
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </AccordionSection>
  );
};
