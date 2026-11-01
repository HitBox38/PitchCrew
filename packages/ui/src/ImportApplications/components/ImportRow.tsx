import type { ApplicationImportRowResult } from '@pitchcrew/core';
import { ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible/index.tsx';
import { importStatusLabels } from '../constants.ts';
import { importPath, importReason, importStatusChange, importTones } from '../helpers.ts';

/** One source row: identity, source → imported status (with its walk), result and reason. */
export const ImportRow = ({ row }: { row: ApplicationImportRowResult }) => {
  const reason = importReason(row);
  return (
    <tr data-status={row.status}>
      <td className="import-row-number tabular-nums">
        <span className="sr-only">Row </span>
        {row.row}
      </td>
      <td className="import-identity">
        <strong data-missing={row.company ? undefined : ''}>{row.company || 'No company'}</strong>
        <span className="block">{row.title || 'Untitled role'}</span>
      </td>
      <td className="import-status" data-label="Status">
        <span>{importStatusChange(row)}</span>
        {row.path.length > 1 ? (
          <span className="import-muted block">{importPath(row.path)}</span>
        ) : null}
      </td>
      <td className="import-result" data-label="Result">
        <span className="ui-chip" data-tone={importTones[row.status]}>
          {importStatusLabels[row.status]}
        </span>
        {reason.text ? <span className="import-reason block">{reason.text}</span> : null}
        {reason.detail ? (
          <Collapsible className="import-detail">
            <CollapsibleTrigger className="import-detail-trigger">
              <ChevronRight size={13} aria-hidden="true" /> Technical details
            </CollapsibleTrigger>
            <CollapsibleContent className="import-muted">{reason.detail}</CollapsibleContent>
          </Collapsible>
        ) : null}
        {row.warnings.map((warning) => (
          <span className="import-muted block" key={warning}>
            {warning}
          </span>
        ))}
      </td>
    </tr>
  );
};
