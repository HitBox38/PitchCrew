import { Bead } from '@/ClayInterface/components/Bead.tsx';
import type { DeskRecord } from '../types.ts';

/**
 * Where a decided row stood, for the rest of the session: a filled bead (moss for a positive
 * outcome), the subject and what happened, quoted whole. It is not a control; the outcome was
 * already said when the decision was taken. Only a line made while the desk was on screen settles
 * in; returning to Home never replays it.
 */
export const NeedsRecord = ({ record, fresh }: { record: DeskRecord; fresh: boolean }) => (
  <div
    className="needs-row"
    data-record=""
    data-kind={record.kind}
    data-fresh={fresh ? '' : undefined}
  >
    <p className="needs-record">
      <Bead tone={record.bead} size="sm" className="needs-bead" />
      <span className="needs-subject">{record.subject}</span>
      <span className="needs-outcome">
        <span className="sr-only">: </span>
        {record.text}
      </span>
    </p>
  </div>
);
