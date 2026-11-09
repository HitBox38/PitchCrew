import type { Approval } from '@pitchcrew/core';
import { CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { copyText } from '@/lib/clipboard.ts';
import { exportHandoffNext } from '../handoff.ts';

/**
 * The success handoff after a local export. The folder path is copied as text only: neither web
 * nor desktop opens arbitrary local folders from here, and downloads use the approved files.
 */
export const ExportHandoff = ({
  approval,
  company,
  current,
}: {
  approval: Approval;
  company: string;
  current: boolean;
}) => {
  const folder = approval.exportDirectory;
  if (!folder) return null;
  return (
    <section className="packet-export-handoff" aria-label="Exported files">
      <CheckCircle2 size={18} aria-hidden="true" />
      <div>
        <h3>Files saved on this computer</h3>
        <p>{exportHandoffNext(approval, current, company)}</p>
        <div className="packet-export-folder">
          <code title={folder}>{folder}</code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyText(folder, 'Copied folder path')}
          >
            <Copy size={14} aria-hidden="true" />
            Copy folder path
          </Button>
        </div>
      </div>
    </section>
  );
};
