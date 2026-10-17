import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import type { ProfileMaintenanceProposal } from '@pitchcrew/core';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';

export function ProposalDocuments({
  proposal,
  selected,
  toggle,
  disabled,
}: {
  proposal: ProfileMaintenanceProposal;
  selected: string[];
  toggle: (name: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3">
      {proposal.documents.map((file) => (
        <details key={file.name} className="approval-preview">
          <summary>
            {file.name} —{' '}
            {file.status === 'conflict' ? 'Replaces a local note; review carefully' : file.status}
          </summary>
          <label className="my-3 flex items-center gap-3">
            <Checkbox
              disabled={disabled}
              checked={selected.includes(file.name)}
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
        </details>
      ))}
      {proposal.evidence?.map((file, index) => (
        <details key={file.path + index} className="approval-preview">
          <summary>Project evidence: {file.path}</summary>
          <a href={file.url} target="_blank" rel="noreferrer" className="underline">
            Pinned source
          </a>
          <SourceBlock label={file.path} value={file.content} contentClassName="font-sans" />
        </details>
      ))}
    </div>
  );
}
