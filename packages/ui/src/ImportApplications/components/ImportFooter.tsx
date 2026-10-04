import { Button } from '@/components/ui/button/components/Button.tsx';
import { LoaderCircle } from 'lucide-react';

export function ImportFooter({
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
}) {
  return (
    <div className="form-footer mt-4 flex justify-end gap-2.5 border-t border-border pt-4">
      <Button className="button" disabled={busy} onClick={onClose}>
        {applied ? 'Done' : 'Cancel'}
      </Button>
      {!applied ? (
        <Button
          className="button primary"
          disabled={busy || !ready}
          onClick={() => void confirmImport()}
        >
          {busy ? <LoaderCircle className="spin" size={15} /> : null}
          Import {ready} {ready === 1 ? 'application' : 'applications'}
        </Button>
      ) : null}
    </div>
  );
}
