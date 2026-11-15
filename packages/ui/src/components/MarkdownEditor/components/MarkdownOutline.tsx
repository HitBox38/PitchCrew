import { useRef, useState } from 'react';
import { ListTree } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Popover, PopoverContent, PopoverTrigger } from '@pitchcrew/design-system/popover';
import { markdownOutline, type OutlineEntry } from '../helpers.ts';

/** The note's headings; choosing one moves the editor (or the preview) to it. */
export const MarkdownOutline = ({
  content,
  line = 0,
  reveal,
}: {
  content: string;
  /** The caret's line: the section holding it is marked as the current location. */
  line?: number;
  reveal: (entry: OutlineEntry, index: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const chosen = useRef(false);
  const entries = open ? markdownOutline(content) : [];
  const top = Math.min(...entries.map((entry) => entry.level));
  const current = entries.findLast((entry) => entry.line <= line);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) chosen.current = false;
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" className="md-tool" />}
        aria-label="Outline"
        title="Outline"
      >
        <ListTree size={15} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="md-outline" finalFocus={() => !chosen.current}>
        <p className="md-outline-title">Outline</p>
        {entries.length ? (
          <ol className="md-outline-list">
            {entries.map((entry, index) => (
              <li key={`${entry.line}`} style={{ ['--level' as string]: entry.level - top }}>
                <button
                  type="button"
                  data-level={entry.level}
                  aria-current={entry === current ? 'location' : undefined}
                  onClick={() => {
                    chosen.current = true;
                    setOpen(false);
                    reveal(entry, index);
                  }}
                >
                  {entry.text}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="md-outline-empty">Headings appear here. Start a line with # to add one.</p>
        )}
      </PopoverContent>
    </Popover>
  );
};
