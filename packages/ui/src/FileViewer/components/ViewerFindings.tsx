import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { keyedItems } from '@/lib/list-keys.ts';
import type { ViewerFile } from '../types.ts';
export const ViewerFindings = ({ file }: { file: ViewerFile }) => {
  if (!file.findings?.length) return null;
  return (
    <AccordionSection
      className="file-verification-notes"
      heading={`${file.findings.length} document layout note${file.findings.length === 1 ? '' : 's'}`}
    >
      {keyedItems(file.findings, (finding) => JSON.stringify(finding)).map(({ item, key }) => (
        <p key={key} className={item.severity === 'error' ? 'text-destructive' : 'text-ochre'}>
          {item.page ? `Page ${item.page}: ` : ''}
          {item.message}
        </p>
      ))}
    </AccordionSection>
  );
};
