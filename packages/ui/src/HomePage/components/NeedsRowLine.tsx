import { Bead } from '@/ClayInterface/components/Bead.tsx';
import type { RowLine } from '../types.ts';

type NeedsRowLineProps = { line: RowLine; tone: 'ochre' | 'rose'; open: boolean };

/**
 * A row's line: its bead (rose only for failed work), the subject over the kind of ask, the ask
 * itself (two lines at most beside the desk) and how long it has waited. While the row is open its
 * ask is the body's headline, so the line shows the job's title there instead. On a narrow desk the
 * subject and kind share a line while both fit whole, else the kind takes its own (`needs-names`).
 * These words are the row button's accessible name.
 */
export const NeedsRowLine = ({ line, tone, open }: NeedsRowLineProps) => (
  <>
    <Bead tone={tone} className="needs-bead" />
    <span className="needs-names">
      <span className="needs-subject">{line.subject}</span>
      <span className="needs-kind">{line.kind}</span>
    </span>
    {open ? (
      line.context ? (
        <span className="needs-ask" data-context="">
          {line.context}
        </span>
      ) : null
    ) : (
      <span className="needs-ask">{line.ask}</span>
    )}
    {line.age ? (
      <span className="needs-age">
        <span className="sr-only">{line.ageCue} </span>
        <time dateTime={line.askedAt}>{line.age}</time>
      </span>
    ) : null}
  </>
);
