import type { CompareRow } from '../compare.ts';

const markers = { added: '+', removed: '−', same: '' } as const;
const spoken = { added: 'Added: ', removed: 'Removed: ', same: '' } as const;

/** The line diff: saved and draft line numbers, a marker column, then the line itself. */
export const ProfileCompareDiff = ({ rows }: { rows: CompareRow[] }) => (
  <table className="profile-diff">
    <caption className="sr-only">Saved copy compared with your draft, line by line</caption>
    <thead className="sr-only">
      <tr>
        <th scope="col">Saved line</th>
        <th scope="col">Draft line</th>
        <th scope="col">Change</th>
        <th scope="col">Text</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row, index) =>
        row.kind === 'skip' ? (
          <tr key={index} className="profile-diff-skip">
            <td colSpan={4}>
              {row.count} unchanged {row.count === 1 ? 'line' : 'lines'}
            </td>
          </tr>
        ) : (
          <tr key={index} data-kind={row.kind}>
            <td className="profile-diff-number">{row.before ?? ''}</td>
            <td className="profile-diff-number">{row.after ?? ''}</td>
            <td className="profile-diff-marker" aria-hidden="true">
              {markers[row.kind]}
            </td>
            <td className="profile-diff-text">
              <span className="sr-only">
                {spoken[row.kind]}
                {row.text ? '' : 'blank line'}
              </span>
              {row.text}
            </td>
          </tr>
        ),
      )}
    </tbody>
  </table>
);
