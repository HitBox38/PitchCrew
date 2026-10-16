import type { DiffLine } from '../types.ts';

const signs = { same: ' ', added: '+', removed: '-' };
const labels = { same: 'Unchanged', added: 'Added', removed: 'Removed' };

/** Unified diff: removed lines are struck through, added lines are highlighted. */
export function InstructionDiff({ lines }: { lines: DiffLine[] }) {
  return (
    <ol
      className="instruction-diff focus-visible:outline-2 focus-visible:outline-ring"
      aria-label="Differences, line by line"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users scroll the bounded diff.
      tabIndex={0}
    >
      {lines.map((line, index) => (
        <li key={index} data-kind={line.kind}>
          <span className="instruction-diff-sign" aria-hidden="true">
            {signs[line.kind]}
          </span>
          <span className="sr-only">{labels[line.kind]}: </span>
          <span className="instruction-diff-text">
            {line.segments
              ? line.segments.map((segment, part) =>
                  segment.kind === 'same' ? (
                    <span key={part}>{segment.text}</span>
                  ) : segment.kind === 'added' ? (
                    <ins key={part}>{segment.text}</ins>
                  ) : (
                    <del key={part}>{segment.text}</del>
                  ),
                )
              : line.text || ' '}
          </span>
        </li>
      ))}
    </ol>
  );
}
