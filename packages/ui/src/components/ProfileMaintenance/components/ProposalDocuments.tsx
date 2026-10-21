import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import type { ProfileMaintenanceProposal } from '@pitchcrew/core';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';

export const ProposalDocuments = ({
  proposal,
  selected,
  toggle,
  disabled,
}: {
  proposal: ProfileMaintenanceProposal;
  selected: string[];
  toggle: (name: string) => void;
  disabled: boolean;
}) => {
  const selectedNames = new Set(selected);
  return (
    <div className="grid gap-3">
      {proposal.documents.map((file) => (
        <AccordionSection
          key={file.name}
          className="approval-preview"
          heading={
            <>
              {file.name} —{' '}
              {file.status === 'conflict' ? 'Replaces a local note; review carefully' : file.status}
            </>
          }
        >
          <label className="my-3 flex items-center gap-3">
            <Checkbox
              disabled={disabled}
              checked={selectedNames.has(file.name)}
              onCheckedChange={() => toggle(file.name)}
            />
            Apply this document
          </label>
          <a href={file.url} target="_blank" rel="noreferrer" className="underline">
            Source: {file.path}
          </a>
          <div className="mt-3 grid gap-3 wide:grid-cols-2">
            <div>
              <SourceBlock
                label="Current note"
                value={file.before ?? 'New note'}
                contentClassName="font-sans"
              />
            </div>
            <div>
              <SourceBlock
                label="Proposed note"
                value={file.content}
                contentClassName="font-sans"
              />
            </div>
          </div>
        </AccordionSection>
      ))}
      {proposal.evidence?.map((file, index) => (
        <AccordionSection
          key={file.path + index}
          className="approval-preview"
          heading={<>Project evidence: {file.path}</>}
        >
          <a href={file.url} target="_blank" rel="noreferrer" className="underline">
            Pinned source
          </a>
          <SourceBlock label={file.path} value={file.content} contentClassName="font-sans" />
        </AccordionSection>
      ))}
    </div>
  );
};
