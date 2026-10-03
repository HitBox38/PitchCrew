import type { ProfileMaintenanceProposal } from '@pitchcrew/core';

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
        <details key={file.name} className="rounded-lg border border-border p-3">
          <summary>
            {file.name} —{' '}
            {file.status === 'conflict' ? 'Replaces a local note; review carefully' : file.status}
          </summary>
          <label className="my-3 flex items-center gap-2">
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(file.name)}
              onChange={() => toggle(file.name)}
            />
            Apply this document
          </label>
          <a href={file.url} target="_blank" rel="noreferrer" className="underline">
            Source: {file.path}
          </a>
          <div className="mt-3 grid gap-3 wide:grid-cols-2">
            <div>
              <h4>Current note</h4>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap">
                {file.before ?? 'New note'}
              </pre>
            </div>
            <div>
              <h4>Proposed note</h4>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap">{file.content}</pre>
            </div>
          </div>
        </details>
      ))}
      {proposal.evidence?.map((file, index) => (
        <details key={file.path + index} className="rounded-lg border border-border p-3">
          <summary>Project evidence: {file.path}</summary>
          <a href={file.url} target="_blank" rel="noreferrer" className="underline">
            Pinned source
          </a>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap">{file.content}</pre>
        </details>
      ))}
    </div>
  );
}
