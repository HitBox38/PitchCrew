import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import type { ProfileMaintenanceProposal } from '@pitchcrew/core';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';

const proposalStatus: Record<string, string> = { new: 'Added', changed: 'Changed' };
const proposalTone: Record<string, string> = { new: 'moss', changed: 'primary', conflict: 'ochre' };

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
    <div className="profile-proposal-documents">
      {proposal.documents.map((file) => (
        <AccordionSection
          key={file.name}
          className="profile-proposal-document"
          heading={
            <span className="flex flex-wrap items-center gap-2">
              {file.name}
              <span className="ui-chip" data-tone={proposalTone[file.status] ?? undefined}>
                {file.status === 'conflict'
                  ? 'Replaces a local note; review carefully'
                  : (proposalStatus[file.status] ?? file.status)}
              </span>
            </span>
          }
        >
          <label className="profile-proposal-apply">
            <Checkbox
              disabled={disabled}
              checked={selectedNames.has(file.name)}
              onCheckedChange={() => toggle(file.name)}
            />
            Apply this document
          </label>
          <a href={file.url} target="_blank" rel="noreferrer" className="profile-proposal-link">
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
          className="profile-proposal-document"
          heading={<>Project evidence: {file.path}</>}
        >
          <a href={file.url} target="_blank" rel="noreferrer" className="profile-proposal-link">
            Pinned source
          </a>
          <SourceBlock label={file.path} value={file.content} contentClassName="font-sans" />
        </AccordionSection>
      ))}
    </div>
  );
};
