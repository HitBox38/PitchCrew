import { Modal } from '@/components/Modal/index.tsx';
import { useImportApplications } from '../hooks/useImportApplications.ts';
import { ImportFileField } from './ImportFileField.tsx';
import { ImportFooter } from './ImportFooter.tsx';
import { ImportPreviewTable } from './ImportPreviewTable.tsx';
import { ImportSummary } from './ImportSummary.tsx';

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const controller = useImportApplications();
  const { report, result, busy, error } = controller;
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <Modal title="Import applications" drawer className="import-applications" onClose={close}>
      <p className="modal-intro">
        Bring in applications from an older tracker. Nothing is sent or submitted. You review every
        row before anything is saved.
      </p>
      <ImportFileField
        busy={busy}
        locked={!!result}
        upload={controller.upload}
        chooseFile={controller.chooseFile}
      />
      {error ? (
        <p className="form-error mt-3" role="alert">
          {error}
        </p>
      ) : null}
      {report ? <ImportSummary report={report} applied={!!result} /> : null}
      {report ? <ImportPreviewTable report={report} /> : null}
      <ImportFooter
        busy={busy}
        ready={controller.ready}
        applied={!!result}
        onClose={close}
        confirmImport={controller.confirmImport}
      />
    </Modal>
  );
}
