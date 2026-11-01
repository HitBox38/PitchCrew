import { ImportDialog } from './components/ImportDialog.tsx';

/** Import applications tracked before Pitchcrew; opened from the Board's Add job menu. */
export const ImportApplications = ({ open, onClose }: { open: boolean; onClose: () => void }) =>
  open ? <ImportDialog onClose={onClose} /> : null;
