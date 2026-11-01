import { Modal } from '@/components/Modal/index.tsx';
import { useImportApplications } from '../hooks/useImportApplications.ts';
import { ImportFileField } from './ImportFileField.tsx';
import { ImportFooter } from './ImportFooter.tsx';
import { ImportPreviewTable } from './ImportPreviewTable.tsx';
import { ImportCounts } from './ImportCounts.tsx';
import { ImportSteps } from './ImportSteps.tsx';

export const ImportDialog = ({ onClose }: { onClose: () => void }) => {
  const controller = useImportApplications();
  const { report, result, busy, error } = controller;
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <Modal title="Import applications" className="import-applications" onClose={close}>
      <ImportSteps step={result ? 2 : report ? 1 : 0} />
      <div className="import-body">
        {result ? null : (
          <ImportFileField
            busy={busy}
            upload={controller.upload}
            chooseFile={controller.chooseFile}
          />
        )}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {report ? <ImportCounts report={report} applied={!!result} /> : null}
        {report ? <ImportPreviewTable report={report} /> : null}
      </div>
      <ImportFooter
        busy={busy}
        ready={controller.ready}
        applied={!!result}
        onClose={close}
        confirmImport={controller.confirmImport}
      />
    </Modal>
  );
};
