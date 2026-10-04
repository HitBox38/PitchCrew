import { Button } from '@/components/ui/button/components/Button.tsx';
import { Upload } from 'lucide-react';
import { useState } from 'react';
import { ImportDialog } from './components/ImportDialog.tsx';

/** Board entry for importing applications tracked before Pitchcrew. */
export function ImportApplications() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="button" onClick={() => setOpen(true)}>
        <Upload size={16} /> Import applications
      </Button>
      {open ? <ImportDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
