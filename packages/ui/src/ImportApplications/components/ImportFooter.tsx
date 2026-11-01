import { importButtonLabel } from '../helpers.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { LoaderCircle } from 'lucide-react';

export const ImportFooter = ({
  busy,
  ready,
  applied,
  onClose,
  confirmImport,
}: {
  busy: boolean;
  ready: number;
  applied: boolean;
  onClose: () => void;
  confirmImport: () => Promise<void>;
}) => (
  <div className="ui-footer-bar import-footer">
    <span className="ui-footer-note" aria-live="polite">
      {busy && ready ? 'Importing applications. Keep this open until it finishes.' : ''}
    </span>
    {applied ? (
      <Button onClick={onClose}>Done</Button>
    ) : (
      <>
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy || !ready} onClick={() => void confirmImport()}>
          {busy ? <LoaderCircle className="spin" size={15} /> : null}
          {importButtonLabel(busy, ready)}
        </Button>
      </>
    )}
  </div>
);
